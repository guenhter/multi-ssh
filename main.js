const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const pty = require("node-pty");
const fs = require("node:fs");
const os = require("node:os");
const yaml = require("js-yaml");

// Keep a global reference of the window object
let mainWindow;
let ptyProcesses = {}; // Object of terminal processes keyed by hostname
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

// IPC handlers for terminal communication
ipcMain.on("terminal-input", (_event, { hostname, data }) => {
    if (ptyProcesses[hostname]) {
        ptyProcesses[hostname].write(data);
    }
});

ipcMain.on("terminal-resize", (_event, { hostname, cols, rows }) => {
    if (ptyProcesses[hostname]) {
        ptyProcesses[hostname].resize(cols, rows);
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

ipcMain.on("switch-host-group", (_event, groupName) => {
    const hosts = config.hostGroups[groupName];
    terminateAllTerminals();

    mainWindow?.webContents?.send("clear-all-terminals");
    if (hosts) {
        // It can potentially happen that the renderer is not ready with the terminal creation
        // but the initializeTerminalsForHosts is already working and is faster so the renderer
        // won't show the content then of a terminal (in theory I guess). If this happens, we should
        // redesign this process.
        mainWindow?.webContents?.send("initialize-terminals", hosts);
        initializeTerminalsForHosts(hosts);
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

    // Emitted when the window is closed
    mainWindow.on("closed", () => {
        terminateAllTerminals();
        mainWindow = null;
    });

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
}

function terminateAllTerminals() {
    // Clean up PTY processes
    Object.values(ptyProcesses).forEach((process) => {
        if (process) {
            // Remove listeners to prevent any residual callbacks
            process.removeAllListeners("data");
            process.removeAllListeners("exit");
            if (!process.killed) {
                process.kill();
            }
        }
    });

    ptyProcesses = {};
}

function initializeTerminalsForHosts(hosts) {
    const shell = "ssh";
    console.log("Using shell:", shell);

    for (const hostname of hosts) {
        try {
            initializeTerminal(hostname, shell);
        } catch (error) {
            console.error(
                `Failed to spawn SSH session for ${hostname} process:`,
                error,
            );
            mainWindow?.webContents?.send("terminal-data", {
                hostname,
                data: `\r\n\x1b[91mFailed to start SSH session for ${hostname}: ${error.message}\x1b[0m\r\n`,
            });
        }
    }
}

// Initialize PTY processes
function initializeTerminal(hostname, shell) {
    // Use node-pty for proper pseudo-terminal functionality
    const ptyProcess = pty.spawn(shell, [hostname], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.env.USERPROFILE || "/",
        env: process.env,
    });
    ptyProcesses[hostname] = ptyProcess;

    // Send data from PTY to renderer
    ptyProcess.onData((data) => {
        mainWindow?.webContents?.send("terminal-data", { hostname, data });
    });

    // Handle process exit
    ptyProcess.onExit(({ exitCode, _signal }) => {
        const exitMessage = `\r\n\x1b[91mSSH session to ${hostname} exited with code: ${exitCode}\x1b[0m\r\n`;
        mainWindow?.webContents?.send("terminal-data", {
            hostname,
            data: exitMessage,
        });
        delete ptyProcesses[hostname];
    });
}
