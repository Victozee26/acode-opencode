<div align="center">

# Acode Plugin OpenCode

![Version](https://img.shields.io/badge/version-0.1.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Acode](https://img.shields.io/badge/Acode-Compatible-orange.svg)

**Run the OpenCode AI coding agent inside Acode Editor**

[Features](#features) • [Installation](#installation) • [Requirements](#requirements) • [Build](#build) • [Contributing](#contributing)

</div>

**Acode-OpenCode** is an Acode plugin that launches [OpenCode](https://github.com/anomalyco/opencode) — an AI coding agent — as a background HTTP server inside Acode's built-in Alpine Linux terminal, then embeds its web UI in a full-page iframe. Instead of running OpenCode on a separate machine, this plugin runs it locally on your device and talks to it over loopback, giving you a fully self-contained AI coding workflow inside Acode.

<div align="center" style="display: flex; width: 100%; align-item: center">
  <img src="https://raw.githubusercontent.com/Victozee26/acode-opencode/main/asset/opencode-wordmark-dark.png" alt="OpenCode wordmark" width="100%"/>
</div>

## Requirements

**Node.js and npm** must be available in Acode's built-in Alpine Linux terminal, and OpenCode is installed automatically on first launch. Acode must be a recent version with Terminal and Executor API support:

```bash
apk add --no-cache nodejs npm
```

## Features

- **Local OpenCode server.** Runs OpenCode as a background HTTP server inside Acode's Alpine terminal — no external machine required.
- **Automatic install.** Detects whether OpenCode is present and installs it on demand (`npm install -g opencode-ai`).

## Installation

1. Open **Settings**
2. Select **Plugins**
3. Search for **"OpenCode"**
4. Tap **Install**
5. Restart

### How It Works

The plugin follows a **Check → Install → Serve → Render** workflow:

| Stage               | Responsibility                                                            |
| ------------------- | ------------------------------------------------------------------------- |
| **Check**           | Verify OpenCode is installed and whether the server is already running    |
| **Install**         | Install OpenCode via `npm install -g opencode-ai` if missing              |
| **Serve**           | Start `opencode serve --port 4096 --hostname 127.0.0.1` in the background |
| **Render**          | Embed the web UI in an iframe and reactively reflect the current state    |

## Project Structure

```
src/
  main.ts               # plugin init/destroy, flow orchestration
  types.ts              # AppState enum, StateContext, ErrorInfo
  state.ts              # state machine (transition, onStateChange, reset)
  logger.ts             # leveled logging (createLogger, setLogEnabled, setLogLevel)
  error.ts              # extractErrorInfo() — normalizes unknown errors
  config/               # named constants, split by domain
  terminal/executor.ts  # thin wrapper over global Executor
  opencode/
    install.ts          # checkInstalled, installOpenCode
    server.ts           # isServerUp, startServer, stopServer, restartServer
    health.ts           # loopback health probe via cordova.plugin.http
  ui/
    index.ts            # render orchestrator, one render func per state
    components/         # DOM factory functions, one file per component
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request and leave a ⭐

## Credits & Attribution

This project (the Acode OpenCode integration) is licensed under the MIT License. See the `LICENSE` file.

- OpenCode — https://github.com/anomalyco/opencode  
  Licensed under the MIT License.

## Support & Contact

- **Issues**: [GitHub Issues](https://github.com/Victozee26/acode-opencode/issues)
- **Email**: victorelijha@gmail.com

---

<div align="center">

_Happy coding ✨_

</div>
