# AGENTS.md

A comprehensive guide for AI agents working on the multi-ssh project, providing context and instructions for effective development assistance.

## Project Overview

multi-ssh is an electron app allowing to connect to multiple ssh hosts at the same time wich one separate embedded terminal per session.

## General Guidelines

- **KISS Principle**: Always strive for simple and easy solutions
- **Documentation**: Keep documentation concise; don't create additional docs unless requested
- **Task Planning**: Create TODO items before starting work, prioritizing document reading first


## Commands

```bash
npm run start                  # Start the whole application
```

## Conventions

- **ipcRenderer frontend binding**: In the `renderer.js` keep all global `ipcRenderer` bindings like `ipcRenderer.on(...)` at the top
