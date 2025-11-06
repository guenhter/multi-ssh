const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const pty = require("node-pty");
const fs = require("node:fs");
const os = require("node:os");
const yaml = require("js-yaml");

// Keep a global reference of the window object
let mainWindow;
let ptyProcesses = []; // Array of terminal processes
let config; // Will be loaded later

function loadConfig() {
    const configPaths = [
        path.join(process.cwd(), "multi_ssh_config.yaml"),
        path.join(os.homedir(), "multi_ssh_config.yaml"),
        "/etc/multissh/multi_ssh_config.yaml",
    ];

    for (const configPath of configPaths) {
        try {
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, "utf8");
                console.log(`Config loaded from: ${configPath}`);
                return yaml.load(configData);
            }
        } catch (error) {
            // Continue to next path if this one fails
            console.warn(
                `Failed to load config from ${configPath}:`,
                error.message,
            );
        }
    }

    throw new Error(
        `Config file not found in any of the following locations: ${configPaths.join(", ")}`,
    );
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
    createWindow();
});

ipcMain.on("renderer-ready", () => {
    initializeAllTerminals();
});

// IPC handlers for terminal communication
ipcMain.on("terminal-input", (_event, { index, data }) => {
    if (ptyProcesses[index]) {
        ptyProcesses[index].write(data);
    } else {
        // Fallback if process died
        mainWindow?.webContents?.send(
            `terminal-data-${index}`,
            "\r\n\x1b[91mSSH session not available\x1b[0m\r\n$ ",
        );
    }
});

ipcMain.on("terminal-resize", (_event, { index, cols, rows }) => {
    if (ptyProcesses[index]) {
        ptyProcesses[index].resize(cols, rows);
    }
});

ipcMain.on("toggle-dev-tools", () => {
    if (mainWindow) {
        if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
        } else {
            mainWindow.webContents.openDevTools();
        }
    }
});

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 1000,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            sandbox: false,
            webSecurity: false,
        },
        icon: path.join(__dirname, "assets/ssh.png"), // Optional: add an icon
        titleBarStyle: "default",
        show: false, // Don't show until ready
    });

    // Load the index.html file
    mainWindow.loadFile("index.html");
    mainWindow.removeMenu();

    // Show window when ready to prevent visual flash
    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
        // Load and send config to renderer
        try {
            config = loadConfig();
            mainWindow.webContents.send("config", config);
        } catch (error) {
            console.error("Failed to load config:", error);
            mainWindow.webContents.send("config-error", error.message);
        }
        // Wait for renderer ready before initializing PTY
    });

    // Emitted when the window is closed
    mainWindow.on("closed", () => {
        // Clean up PTY processes
        ptyProcesses.forEach((process, _index) => {
            if (process && !process.killed) {
                process.kill();
            }
        });
        ptyProcesses = [];
        // Dereference the window object
        mainWindow = null;
    });
}

function initializeAllTerminals() {
    const shell = "ssh";
    console.log("Using shell:", shell);

    for (let i = 0; i < config.hosts.length; i++) {
        try {
            initializeTerminal(i, shell, config.hosts[i]);
        } catch (error) {
            console.error(`Failed to spawn SSH session ${i} process:`, error);
            mainWindow?.webContents?.send(
                `terminal-data-${i}`,
                `\r\n\x1b[91mFailed to start SSH session ${i + 1}: ${error.message}\x1b[0m\r\n`,
            );
        }
    }
}

// Initialize PTY processes
function initializeTerminal(index, shell, host) {
    // Use node-pty for proper pseudo-terminal functionality
    const ptyProcess = pty.spawn(shell, [host], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.env.USERPROFILE || "/",
        env: process.env,
    });

    // Send data from PTY to renderer
    ptyProcess.onData((data) => {
        mainWindow?.webContents?.send(`terminal-data-${index}`, data);
    });

    // Handle process exit
    ptyProcess.onExit(({ exitCode, signal }) => {
        mainWindow?.webContents?.send(`terminal-exit-${index}`, {
            code: exitCode,
            signal,
        });
    });

    ptyProcesses[index] = ptyProcess;
}
