# Multi SSH

A multi-SSH terminal application built with Electron, providing a unified interface to manage multiple SSH connections simultaneously using xterm.js for terminal emulation and node-pty for pseudo-terminal support.

## Features

- **Multi-Terminal Interface**: Connect to multiple SSH hosts in separate terminal panes
- **Real Terminal Emulation**: Full shell integration with proper PTY support
- **Modern UI**: Dark-themed interface with responsive design
- **Send to All**: Option to broadcast commands to all connected terminals
- **Copy/Paste Support**: Full keyboard shortcuts support (Ctrl+C/Ctrl+V or Cmd+C/Cmd+V on Mac)

## Configuration

Create a `config.yaml` file based on `config_sample.yaml` with your SSH hosts:

```yaml
hosts:
  - user@host1
  - user@host2
  - user@host3
```

## Development Notes

### Commands

```bash
pnpm start  # Development Mode
pnpm build  # Building the Application
pnpm dist   # Creating Distribution Package
```

### Project Structure

```
multi-ssh/
├── main.js                 # Main Electron process with PTY integration
├── renderer.js             # Renderer process with xterm.js terminals
├── index.html              # Main UI layout
```

## License

MIT

[SSH icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/ssh)
