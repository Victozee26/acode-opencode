# Acode Plugin Development Guide — OpenCode Plugin

Practical guidance for the `acode-opencode` project. See `docs/acode-plugin-api-reference.md` for the full API reference.

---

## 1. Project-Specific API Usage

### APIs In Active Use

| API | Module | Usage in project |
|-----|--------|-----------------|
| `acode.setPluginInit` | Global | Entry point in `src/main.ts` |
| `acode.setPluginUnmount` | Global | Cleanup in `src/main.ts` |
| `acode.addIcon` | Global | Toolbar icon registration |
| `acode.require('sideButton')` | Side Button | Right-edge button to launch plugin page |
| `acode.require('terminal')` | Terminal | `Executor.execute()` for shell commands in Alpine |
| `$page.show()` / `$page.hide()` | WCPage | Toggle plugin full-page view |
| `$page.settitle()` | WCPage | Set page title to "OpenCode" |
| `$page.body` | WCPage | DOM container for spinner/iframe/error UI |
| `$page.header` | WCPage | DOM container for header bar |
| `$page.on('show', cb)` | WCPage | Trigger flow when user opens page |

### APIs Available But Not Yet Used

These could enhance the plugin in future iterations:

| API | Potential use |
|-----|---------------|
| `acode.require('actionStack')` | Back-button support when plugin page is open |
| `acode.require('toast')` | Show "Server ready" / "Install complete" notifications |
| `acode.pushNotification()` | In-app notification for server status changes |
| `editorManager.activeFile` | Get current project path for auto-navigation |
| `acode.require('sidebarApps')` | Alternative to side button — persistent sidebar panel |
| `acode.require('loader')` | Alternative to custom spinner for loading states |
| `Terminal.isInstalled()` | Check Alpine readiness before attempting commands |
| `PLUGIN_DIR` / `CACHE_STORAGE` | File paths for logs or config persistence |

---

## 2. Known Gotchas & Patterns

### Executor.execute() Is Blocking

```typescript
// WRONG — will hang forever:
await Executor.execute('opencode serve --port 4096');

// CORRECT — background and detach (no `disown` — not available in BusyBox ash):
await Executor.execute(
  'mkdir -p /tmp && nohup opencode serve --port 4096 --hostname 127.0.0.1 > /tmp/opencode.log 2>&1 &'
);
```

The `execute()` promise resolves only after the command exits. For persistent processes (the OpenCode server), the `nohup ... &` pattern is mandatory. (`disown` is a bash-ism not available in BusyBox `ash`.)

### No Output Streaming

`Executor.execute()` returns the full command output only after completion. There is no way to stream progress. This is why the plugin uses an indeterminate spinner during install rather than a progress bar.

### Module Access Pattern

```typescript
// Correct — unt typed
const terminal: { Executor: Executor } = acode.require('terminal') as any;

// The Executor type is globally available (provided by acode-plugin-types)
// but the terminal module itself has no TypeScript types
```

### Icon Registration

```typescript
// Acode addIcon registers a CSS class — must match in HTML/markup
acode.addIcon('my-icon', baseUrl + 'icon.png');
// Usage: <i class="icon my-icon"></i>
```

### $page.show() and Action Stack

When showing the plugin page, consider pushing to the action stack for proper Android back-button behavior:

```typescript
$page.show = () => {
  const actionStack = acode.require('actionStack');
  actionStack.push({
    id: 'opencode-plugin',
    action: $page.hide,
  });
  app.append($page);
};
```

### Health Check via `cordova.plugin.http`

The health check probes `http://127.0.0.1:4096/global/health` using `cordova.plugin.http` (Cordova Advanced HTTP), which performs requests on the native network stack — so WebView CORS does NOT apply and the loopback probe resolves instead of hanging. A plain `fetch` to `127.0.0.1` is blocked by WebView CORS and hangs forever, so it is only used as a fallback when `cordova.plugin.http` is absent (e.g. under Vitest/jsdom). Any response (success or a positive status) means the server is up; connection-refused/timeout means down.

### String Building in Shell Commands

When constructing shell commands with dynamic paths:

```typescript
// Bad — path injection risk
await execute(`cd ${userPath} && ...`);

// Better — ensure proper quoting
await execute(`cd "${userPath}" && ...`);
```

### Re-entry Protection

The `startFlow()` method uses an `isRunning` flag to prevent double-execution. This is important because `$page.on('show')` can fire multiple times.

```typescript
$page.on('show', () => {
  if (!this.isRunning) {
    this.startFlow();
  }
});
```

---

## 3. Build & Deploy

### Build Pipeline

```
tsc --noEmit → esbuild bundle → zip dist/
```

- **Dev:** `npm run dev` — typecheck → esbuild watch + local server on port 3000
- **Build:** `npm run build` — typecheck → esbuild bundle → `dist.zip`
- **Test:** `npm test` — vitest with jsdom

### Dev Installation in Acode

1. Run `npm run dev` on your dev machine
2. In Acode → Plugin Manager → **Remote** option
3. Enter `http://<your-ip>:3000/dist.zip`
4. Plugin installs and updates on reload when files change

### Production Artifact

`dist.zip` is the final plugin artifact. Contains:
- `dist/main.js` (bundled plugin code)
- `plugin.json`
- `icon.png`
- `readme.md`, `changelogs.md`

---

## 4. Plugin Structure Conventions

### Entrypoint

```typescript
// src/main.ts
import plugin from '../plugin.json';

const acodePlugin = new AcodePlugin();

acode.setPluginInit(
  plugin.id,
  async (baseUrl, $page, { cacheFile, cacheFileUrl }) => {
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    await acodePlugin.init(baseUrl, $page, cacheFile, cacheFileUrl);
  },
);

acode.setPluginUnmount(plugin.id, () => {
  acodePlugin.destroy();
});
```

### `plugin.json` Notes

- `main` must point to the bundled output: `"dist/main.js"`
- `minVersionCode: 290` is the safe minimum (when plugin support was added)
- `icon.png` must be ≤50KB
- For the `files` array, list only additional files (not in dist/ already)

---

## 5. Testing Considerations

### Mocking Acode APIs

In Vitest (jsdom), acode APIs are mocked. Test setups must provide:

```typescript
// Example mock for terminal tests
globalThis.acode = {
  require: vi.fn((name) => {
    if (name === 'terminal') return { Executor: { execute: vi.fn() } };
    return {};
  }),
} as any;
```

### Key Test Scenarios

1. Install flow: fresh install → `which opencode` fails → `apk add` + `npm install` succeed
2. Server detection: `isServerUp()` returns true → skip to Ready state
3. Server start: `startServer()` → `waitForReady()` polling loop → timeout handling
4. Restart: `restartServer()` kills old process and starts new one
5. Error states: install failure, server start timeout, server crash

---

## 6. Useful Links

- [Acode Plugin Docs](https://docs.acode.app/docs/)
- [Official JS Plugin Template](https://github.com/Acode-Foundation/acode-plugin)
- [Official TS Plugin Template](https://github.com/Acode-Foundation/AcodeTSTemplate)
- [Acode Plugin CLI (scaffolding)](https://github.com/itsvks19/acode-plugin-cli)
- [Plugin Docs GitHub](https://github.com/Acode-Foundation/acode-plugin-docs)
