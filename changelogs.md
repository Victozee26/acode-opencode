# Changelogs

## 0.3.0
- V2 compactable and still backward compactable with V1
- V1 installs keep working unchanged pressing Update migrates V1 to V2 in a single press.
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
