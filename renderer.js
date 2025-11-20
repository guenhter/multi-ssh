// Renderer process script
const { ipcRenderer } = require("electron");
const { Terminal } = require("@xterm/xterm");
const { FitAddon } = require("@xterm/addon-fit");

// Terminal variables
let config;
let terminals = {}; // Object of terminals keyed by hostname
let fitAddons = {}; // Object of fit addons keyed by hostname
let lastPasteTime = 0;
const PASTE_DEBOUNCE_MS = 100;

// Listen for F12 to toggle dev tools
window.addEventListener("keydown", (event) => {
    if (event.key === "F12") {
        ipcRenderer.send("toggle-dev-tools");
        event.preventDefault();
    }
});

// Handle window resize
window.addEventListener("resize", () => {
    Object.values(fitAddons).forEach((fitAddon) => {
        if (fitAddon) {
            fitAddon.fit();
        }
    });
});

// ipcRenderer.on(...) will listen for messages from the backend process

ipcRenderer.on("config", (_event, receivedConfig) => {
    config = receivedConfig;
    populateHostGroupDropdown();
});

ipcRenderer.on("config-error", (_event, errorMessage) => {
    const container = document.getElementById("terminals-container");
    if (container) {
        container.innerHTML = `<div style="color: red; padding: 20px; font-size: 18px;">Error loading configuration: ${errorMessage}</div>`;
    }
});

ipcRenderer.on("initialize-terminals", (_event, hosts) => {
    initializeTerminals(hosts);
});

ipcRenderer.on("clear-all-terminals", () => {
    clearAllTerminals();
});

ipcRenderer.on("terminal-data", (_event, { hostname, data }) => {
    if (terminals[hostname]) {
        terminals[hostname].write(data);
        terminals[hostname].scrollToBottom();
    }
});

// Listen for clear command
ipcRenderer.on("terminal-clear", (_event, { hostname }) => {
    if (terminals[hostname]) {
        terminals[hostname].clear();
    }
});

// Populate host group dropdown
function populateHostGroupDropdown() {
    const select = document.getElementById("host-group-select");
    select.innerHTML = '<option value="">Select Host Group</option>';
    for (const groupName in config.hostGroups) {
        const option = document.createElement("option");
        option.value = groupName;
        option.textContent = groupName;
        select.appendChild(option);
    }
    select.addEventListener("change", (event) => {
        const groupName = event.target.value;
        if (groupName) {
            ipcRenderer.send("switch-host-group", groupName);
        }
    });
}

// Initialize xterm.js terminals
function initializeTerminals(hosts) {
    const container = document.getElementById("terminals-container");
    if (!container) {
        return;
    }

    for (const hostname of hosts) {
        const { wrapper, terminal, fitAddon } = createSingleTerminal(
            hostname,
            config,
        );

        container.appendChild(wrapper);
        terminals[hostname] = terminal;
        fitAddons[hostname] = fitAddon;

        // Focus the first terminal
        if (hostname === hosts[0]) {
            terminal.focus();
        }
    }
}

// Create single terminal
function createSingleTerminal(hostname, config) {
    // Create wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "terminal-wrapper";
    wrapper.style.flex = `1 1 ${config.terminalMinWidth}px`;
    wrapper.style.height = `${config.terminalHeight}px`;

    // Create title bar
    const titleBar = document.createElement("div");
    titleBar.className = "terminal-title-bar";
    titleBar.textContent = hostname;
    wrapper.appendChild(titleBar);

    // Create terminal container
    const termContainer = document.createElement("div");
    termContainer.className = "terminal-container";
    wrapper.appendChild(termContainer);

    // Create terminal div
    const termDiv = document.createElement("div");
    termDiv.className = "terminal";
    termDiv.id = `terminal-${hostname}`;
    termContainer.appendChild(termDiv);

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

    // Fit terminal to container after layout is complete
    requestAnimationFrame(() => {
        fitAddon.fit();
    });

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
            if (Date.now() - lastPasteTime < PASTE_DEBOUNCE_MS) return true;
            lastPasteTime = Date.now();
            navigator.clipboard.readText().then((text) => {
                sendTerminalInput(text, hostname);
            });
            return true; // Having false here for some reason adds the text twice...
        }

        return true; // Allow all other keys to work normally
    });

    // Handle terminal input
    terminal.onData((data) => {
        sendTerminalInput(data, hostname);
    });

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
        ipcRenderer.send("terminal-resize", {
            hostname: hostname,
            cols,
            rows,
        });
    });

    return { wrapper, terminal, fitAddon };
}

// Send terminal input to all hosts or specific host
function sendTerminalInput(data, hostname) {
    const sendToAll = document.getElementById("send-to-all").checked;
    if (sendToAll) {
        for (const host of Object.keys(terminals)) {
            ipcRenderer.send("terminal-input", {
                hostname: host,
                data,
            });
        }
    } else {
        ipcRenderer.send("terminal-input", {
            hostname,
            data,
        });
    }
}

function clearAllTerminals() {
    const container = document.getElementById("terminals-container");
    if (container) {
        container.innerHTML = "";
    }
    // Clear terminal objects
    Object.values(terminals).forEach((terminal) => {
        if (terminal) {
            terminal.dispose();
        }
    });
    terminals = {};
    fitAddons = {};
}
