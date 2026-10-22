<div align="center" style="padding: 14px 10%;">
  <img src="https://raw.githubusercontent.com/Victozee26/acode-opencode/main/asset/opencode-wordmark-dark.png" alt="OpenCode wordmark" width="100%"/>
</div>

<div align="center">

![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Acode](https://img.shields.io/badge/Acode-Compatible-orange.svg)

</div>

**Run the OpenCode AI coding agent inside Acode Editor**

[Features](#features) • [Installation](#installation) • [Requirements](#requirements) • [Build](#build) • [Contributing](#contributing)

**OpenCode AI** is an Acode plugin that launches [OpenCode](https://github.com/anomalyco/opencode) — an AI coding agent — as a background HTTP server inside Acode's built-in Alpine Linux terminal, then embeds its web UI in a full-page iframe. Instead of running OpenCode on a separate machine, this plugin runs it locally on your device and talks to it over loopback, giving you a fully self-contained AI coding workflow inside Acode.

## Screenshot

<div align="center">
  <img src="https://raw.githubusercontent.com/Victozee26/acode-opencode/main/asset/SCREENSHOT-1.png" alt="OpenCode running inside Acode" width="100%"/>
</div>

<div align="center">
  <img src="https://raw.githubusercontent.com/Victozee26/acode-opencode/main/asset/SCREENSHOT-2.png" alt="OpenCode prompt interface" width="40%"/>
</div>

## Requirements

**Node.js and npm** must be available in Acode's built-in Alpine Linux terminal, and OpenCode is installed automatically on first launch. Acode must be a recent version with Terminal and Executor API support (version code 954 or newer):

```bash
apk add --no-cache nodejs npm
```

The server runs on Acode's foreground executor, so Android cannot kill it while Acode is in the background. Acode keeps its usual "Acode Service" notification on screen for as long as that executor runs — the same notification the terminal shows — and that notification is what keeps the server alive. It also offers a wake-lock button and an Exit action for the service.

## Features

- **Local OpenCode server.** Runs OpenCode as a background HTTP server inside Acode's Alpine terminal — no external machine required.
- **Remote OpenCode server.** Point the plugin at an OpenCode server running on another machine (`192.168.1.10:4096`, `https://host`) and it connects to that one instead, with automatic sign-in.
- **Automatic install.** Detects whether OpenCode is present and installs it on demand (`npm install -g @opencode/cli`).
- **V2 ready with automatic sign-in.** V2 servers start password-protected and the embedded UI signs in on its own; V1 installs keep working, and updating migrates V1 → V2.
- **Dedicated port.** Serves on `127.0.0.1:4123`, so it never clashes with a manually started server.

## Connecting to a remote server

Set **Remote host** in the plugin settings to the address of an OpenCode server that runs somewhere else:

| Value | Connects to |
| ----- | ------------ |
| *(empty)* | A server the plugin installs and runs on this device (default) |
| `192.168.1.10:4096` | `http://192.168.1.10:4096` |
| `opencode.example.com` | `http://opencode.example.com:4096` |
| `https://opencode.example.com` | `https://opencode.example.com:443` |
| `[::1]:4096` | `http://[::1]:4096` |

In remote mode the plugin does not install or start OpenCode on the device — it connects to the remote server and embeds its web UI. If the remote server asks for a password, the plugin prompts once and signs in automatically; cancelling the prompt opens the web UI for a manual login. The password is never stored.

The remote server must be reachable from the device and allow connections from it. OpenCode binds to `127.0.0.1` by default, so start it with a hostname or address the device can reach (for example `opencode serve --port 4096 --hostname 0.0.0.0`) — and put it behind a firewall or a reverse proxy with TLS, because it grants shell access to that machine.

## Installation

1. Open **Settings**
2. Select **Plugins**
3. Search for **"OpenCode AI"**
4. Tap **Install**
5. Restart

### Having trouble?

If the automatic install fails, you can run the installation commands manually in terminal

### How It Works

The plugin follows a **Check → Install → Serve → Render** workflow:

| Stage               | Responsibility                                                            |
| ------------------- | ------------------------------------------------------------------------- |
| **Check**           | Verify OpenCode is installed and whether the server is already running    |
| **Install**         | Install OpenCode via `npm install -g @opencode/cli` if missing             |
| **Serve**           | Start `opencode serve --port 4123 --hostname 127.0.0.1` in the background |
| **Render**          | Embed the web UI in an iframe and reactively reflect the current state    |

## Project Structure

```
src/
  main.ts               # plugin init/destroy, flow orchestration
  types.ts              # AppState enum, StateContext, ErrorInfo
  state.ts              # state machine (transition, onStateChange, reset)
  logger.ts             # leveled logging (createLogger, setLogLevel)
  error.ts              # extractErrorInfo() — normalizes unknown errors
  config/               # named constants, split by domain
  terminal/executor.ts  # thin wrapper over global Executor
  opencode/
    install.ts          # checkInstalled, installOpenCode
    server.ts           # startServer, stopServer, restartServer
    auth.ts             # per-launch password, auth_token iframe sign-in
    remote.ts           # remote host address parsing, remote iframe URL
    update.ts           # checkForUpdates, installUpdate
    health.ts           # version-aware OpenCode API probe via cordova.plugin.http
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
