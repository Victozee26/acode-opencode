# Changelogs

## 0.4.0
- Added a **Remote host** setting: point the plugin at an OpenCode server running on another machine (`192.168.1.10:4096`, `https://host`, or a bracketed IPv6 address) and it connects to that server instead of installing and starting one on the device.
- Remote connections sign in automatically: the plugin asks for the server password once per session and embeds the sign-in URL. Cancelling the prompt still opens the web UI for a manual login.
- The connection check now tells "the server wants a password" from "the server cannot be reached", so a wrong password and an unreachable host produce different errors.
- The background health check follows the connection: it watches the remote server while in remote mode.
- The "Reinstall OpenCode" action is hidden in remote mode — there is no local OpenCode to reinstall.

## 0.3.2
- The server now runs on Acode's foreground executor, so Android no longer kills it when Acode goes to the background. Acode shows a persistent notification while the server runs.
- Fixed the package manifest: `main` now points at the file the zip actually ships (`main.js`), the plugin declares the readme and the extra asset folders, and the minimum Acode version is raised to 954 — the build that introduced the notification API the plugin uses.
- The plugin now checks that Acode's terminal environment is installed before running commands, and says so instead of failing with an opaque shell error.
- Disabling the plugin now stops the server it started, so no orphaned `opencode serve` keeps holding the port.
- Removed a stylesheet that no longer exists (it 404'd on every launch).

## 0.3.1
- Fixed the server check on OpenCode v2: it probed the v1-only `/global/health` route, which v2 answers with the web UI shell, so any HTTP server on the port could pass for OpenCode.
- The check now identifies OpenCode by its API — `/api/config` on v2 (JSON with sign-in, `401` without) and `/global/health` on v1 — and only counts JSON answers as a running server.

## 0.3.0
- V2 compactable and still backward compactable with V1
- V1 installs keep working unchanged pressing Update migrates V1 to V2.
- Fresh installs and updates now use the `@opencode/cli` (v2) npm package.
- Update now removes the legacy `opencode-ai` (v1) package when migrating to V2.
- Plugin port moved 4096 → 4123 (dedicated port, no clash with manual servers; kill patterns scoped to it).
  
## 0.2.5
- Server crash check now confirms multiple times before showing an error.
- Better logging on crash (proot warning noise filtered out).
- Fixed false crash reports when stopping the server or restarting mid-check.

## 0.2.4
- Added a readme note that OpenCode v2 is out but the plugin stays on v1 until an upstream update unblocks v2 support.

## 0.2.3
- Install now checks the npm version and uses `--allow-scripts=opencode-ai` on npm 11.16.0+.
- Error view now shows the node and npm versions in its diagnostics block.
- Updated project documentation.

## 0.2.2
- Added auto-hide header in landscape orientation to maximize content area in fullscreen view.
- Added setting to toggle landscape header behavior.

## 0.2.1
- Renamed the plugin from "OpenCode Web" to "OpenCode AI".
- Handled blocking errors that could prevent the plugin from launching.
- Updated project documentation.

## 0.1.5
- Better installation UX with real-time progress output.
- Improved error handling with smarter retry logic.
- Refined error UI with cleaner styling and theme-aware colors.

## 0.1.4
- Improved error handling UI/UX
- Added option to reinstall OpenCode (uninstalls then reinstalls) directly from the plugin.

## 0.1.3
- Refreshed the plugin UI for a cleaner, more polished look.
- Added ability to update OpenCode directly from the plugin UI (with automatic update checks.

## 0.1.2
- Added a plugin setting for UI scaling, letting you adjust the embedded interface size to your preference.
- Updated project documentation.

## 0.1.0
- Initial release: launch OpenCode as a background server inside Acode's Alpine terminal and embed its web UI in an iframe.
