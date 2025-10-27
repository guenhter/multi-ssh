// Renderer process script
const { ipcRenderer } = require("electron");
const { Terminal } = require("@xterm/xterm");
const { FitAddon } = require("@xterm/addon-fit");

// Terminal variables
let config;
const terminals = [];
const fitAddons = [];

// Display version information
document.addEventListener("DOMContentLoaded", () => {
    if (config) {
        initializeTerminals();
    }
});

// Listen for config
ipcRenderer.on("config", (_event, receivedConfig) => {
    config = receivedConfig;
    if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
    ) {
        initializeTerminals();
    }
});

// Listen for config error
ipcRenderer.on("config-error", (_event, errorMessage) => {
    const container = document.getElementById("terminals-container");
    if (container) {
        container.innerHTML = `<div style="color: red; padding: 20px; font-size: 18px;">Error loading configuration: ${errorMessage}</div>`;
    }
});

// Initialize xterm.js terminals
function initializeTerminals() {
    const container = document.getElementById("terminals-container");
    if (!container) {
        return;
    }

    const sendToAllCheckbox = document.getElementById("send-to-all");
    let sendToAll = false;
    sendToAllCheckbox.addEventListener("change", () => {
        sendToAll = sendToAllCheckbox.checked;
    });

    for (let i = 0; i < config.hosts.length; i++) {
        // Create wrapper
        const wrapper = document.createElement("div");
        wrapper.className = "terminal-wrapper";
        wrapper.style.flex = `1 1 ${config.terminalMinWidth}px`;
        wrapper.style.height = `${config.terminalHeight}px`;

        // Create title bar
        const titleBar = document.createElement("div");
        titleBar.className = "terminal-title-bar";
        titleBar.textContent = config.hosts[i];
        wrapper.appendChild(titleBar);

        // Create terminal container
        const termContainer = document.createElement("div");
        termContainer.className = "terminal-container";
        wrapper.appendChild(termContainer);

        // Create terminal div
        const termDiv = document.createElement("div");
        termDiv.className = "terminal";
        termDiv.id = `terminal-${i}`;
        termContainer.appendChild(termDiv);

        container.appendChild(wrapper);

        // Create terminal instance
        const terminal = new Terminal({
            cursorBlink: true,
            cursorStyle: "block",
            fontFamily:
                '"Cascadia Code", "Fira Code", "Source Code Pro", "Monaco", "Menlo", "Ubuntu Mono", monospace',
            fontSize: 14,
            fontWeight: "normal",
            fontWeightBold: "bold",
            lineHeight: 1.2,
            letterSpacing: 0,
            theme: {
                background: "#0c0c0c",
                foreground: "#ffffff",
                cursor: "#ffffff",
                cursorAccent: "#000000",
                selection: "rgba(255, 255, 255, 0.3)",
                black: "#000000",
                red: "#cd3131",
                green: "#0dbc79",
                yellow: "#e5e510",
                blue: "#2472c8",
                magenta: "#bc3fbc",
                cyan: "#11a8cd",
                white: "#e5e5e5",
                brightBlack: "#666666",
                brightRed: "#f14c4c",
                brightGreen: "#23d18b",
                brightYellow: "#f5f543",
                brightBlue: "#3b8eea",
                brightMagenta: "#d670d6",
                brightCyan: "#29b8db",
                brightWhite: "#ffffff",
            },
            allowProposedApi: true,
        });

        // Create fit addon
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);

        // Open terminal in the container
        terminal.open(termDiv);

        // Fit terminal to container
        fitAddon.fit();

        // Handle copy/paste keyboard shortcuts
        terminal.attachCustomKeyEventHandler((event) => {
            // Handle copy (Ctrl+C or Cmd+C on Mac)
            if ((event.ctrlKey || event.metaKey) && event.key === "c") {
                // Only copy if there's a selection, otherwise let Ctrl+C work as interrupt
                if (terminal.hasSelection()) {
                    navigator.clipboard.writeText(terminal.getSelection());
                    return false; // Prevent default behavior
                }
                return true; // Allow Ctrl+C to work as interrupt if no selection
            }

            // Handle paste (Ctrl+V or Cmd+V on Mac)
            if ((event.ctrlKey || event.metaKey) && event.key === "v") {
                navigator.clipboard
                    .readText()
                    .then((text) => {
                        if (sendToAll) {
                            for (let j = 0; j < config.hosts.length; j++) {
                                ipcRenderer.send("terminal-input", {
                                    index: j,
                                    data: text,
                                });
                            }
                        } else {
                            ipcRenderer.send("terminal-input", {
                                index: i,
                                data: text,
                            });
                        }
                    })
                    .catch((error) => {
                        console.error("Failed to read from clipboard:", error);
                    });
                return false; // Prevent default behavior
            }

            return true; // Allow all other keys to work normally
        });

        // Handle terminal input
        terminal.onData((data) => {
            if (sendToAll) {
                for (let j = 0; j < config.hosts.length; j++) {
                    ipcRenderer.send("terminal-input", { index: j, data });
                }
            } else {
                ipcRenderer.send("terminal-input", { index: i, data });
            }
        });

        // Handle terminal resize
        terminal.onResize(({ cols, rows }) => {
            ipcRenderer.send("terminal-resize", { index: i, cols, rows });
        });

        terminals[i] = terminal;
        fitAddons[i] = fitAddon;

        // Focus the first terminal
        if (i === 0) {
            terminal.focus();
        }
    }

    // Handle window resize
    window.addEventListener("resize", () => {
        terminals.forEach((_terminal, i) => {
            if (fitAddons[i]) {
                fitAddons[i].fit();
            }
        });
    });

    // Notify main that renderer is ready
    ipcRenderer.send("renderer-ready");

    // Listen for data from main process
    for (let i = 0; i < config.hosts.length; i++) {
        ipcRenderer.on(`terminal-data-${i}`, (_event, data) => {
            if (terminals[i]) {
                terminals[i].write(data);
                terminals[i].scrollToBottom();
            }
        });

        // Listen for clear command
        ipcRenderer.on(`terminal-clear-${i}`, () => {
            if (terminals[i]) {
                terminals[i].clear();
            }
        });

        // Handle terminal exit
        ipcRenderer.on(`terminal-exit-${i}`, (_event, { code, _signal }) => {
            if (terminals[i]) {
                terminals[i].write(
                    `\r\n\x1b[91mSSH session to ${config.hosts[i]} exited with code: ${code}\x1b[0m\r\n`,
                );
                terminals[i].scrollToBottom();
            }
        });
    }
}

// Listen for F12 to toggle dev tools
window.addEventListener("keydown", (event) => {
    if (event.key === "F12") {
        ipcRenderer.send("toggle-dev-tools");
        event.preventDefault();
    }
});
