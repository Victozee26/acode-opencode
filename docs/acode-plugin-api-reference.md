# Acode Plugin API Reference

Covers APIs relevant to this project. Source: [Acode Plugin Docs](https://docs.acode.app/docs/).

---

## 1. Global `acode` Object

The global `acode` object provides access to the Acode plugin API. All plugins must interact through it.

### Plugin Lifecycle

#### `acode.setPluginInit(pluginId, initFn, settings?)`

Registers the plugin. The `initFn` receives:

| Parameter | Type | Description |
|-----------|------|-------------|
| `baseUrl` | `string` | Base URL to your plugin's files directory |
| `$page` | `WCPage` | Plugin page object for rendering content |
| `options` | `object` | `{ cacheFileUrl, cacheFile, firstInit }` |

```typescript
acode.setPluginInit('com.example.plugin', (baseUrl, $page, options) => {
  // init logic
});
```

#### `acode.setPluginUnmount(pluginId, unmountFn)`

Registers cleanup function called on disable/uninstall/reload. Always include this.

#### `acode.clearBrokenPluginMark(pluginId)`

Clears a plugin's broken mark so it can be retried on next load.

### Module System

#### `acode.require(moduleName): any`

Requires built-in or plugin-defined modules. Module name is case-insensitive.

Key built-in modules:

| Module Name | Returns | Description |
|-------------|---------|-------------|
| `'terminal'` | `TerminalAPI` | Terminal creation, management, themes |
| `'commands'` | `CommandsAPI` | Command registration/execution |
| `'page'` | `PageFactory` | Creates page UI components |
| `'sideButton'` | `SideButtonFactory` | Side button creation |
| `'sidebarApps'` | `SideBarAppsAPI` | Sidebar mini-app registration |
| `'toast'` | `ToastFn` | Toast notification display |
| `'actionStack'` | `ActionStackAPI` | Back button navigation stack |
| `'Url'` | `UrlUtils` | URL parsing/manipulation |
| `'fs'` | `FileSystemAPI` | File system operations |

#### `acode.define(moduleName, module)`

Defines a custom module for other plugins to use.

### UI Helpers

#### `acode.addIcon(iconName, iconSrc, options?)`

Registers an icon class. `options.monochrome: true` (v967+) uses CSS masks for theming.

```typescript
acode.addIcon('my-icon', baseUrl + 'icon.png');
// Usage: <i class="icon my-icon"></i>
```

#### `acode.exec(command, value?)`

Executes a built-in Acode command (e.g., `'console'`, `'new-terminal'`).

#### `acode.pushNotification(title, message, options?)` v954+

Shows an in-app notification with optional icon, action, type, and autoClose.

#### `acode.toInternalUrl(url): Promise<string>`

Converts `file://` URLs to internal URLs for fetch/Ajax.

#### `acode.alert(title, message)`, `acode.confirm(title, message)`, `acode.prompt(title, message, defaultValue?)`

Standard dialog functions.

### Formatters

- `acode.registerFormatter(pluginId, extensions, formatFn, displayName?)`
- `acode.unregisterFormatter(pluginId)`
- `acode.format(selectIfNull?): Promise<boolean>`
- `acode.formatters: Array<{id, name, exts}>`
- `acode.getFormatterFor(extensions): Array<[string | null, string]>`

### Other

#### `acode.installPlugin(pluginId, installerPluginName)` v954+

Installs a plugin from registry with user consent.

#### `acode.newEditorFile(filename, options?)` v956+

Creates and opens a new editor file.

#### `acode.waitForPlugin(pluginId): Promise<boolean>`

Resolves when target plugin has loaded.

---

## 2. `$page` (WCPage)

The plugin page object passed to `init()` — the main rendering surface.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `body` | `HTMLElement` | Main content container |
| `header` | `HTMLElement` | Header container |
| `innerHTML` | `string` | Page inner HTML |
| `textContent` | `string` | Page text content |
| `lead` | `HTMLElement` | Lead element (before title) if defined |

### Methods

| Method | Description |
|--------|-------------|
| `appendBody(...elements)` | Add elements to main content area |
| `appendOuter(...elements)` | Add elements outside main content |
| `on(event, callback)` | Add event listener |
| `off(event, callback)` | Remove event listener |
| `settitle(title)` | Update page title (note: project uses `$page.settitle`) |
| `hide()` | Hide the page |

### Using `$page.show()`

`$page` comes with a built-in `show()` method that appends the page to `app` and pushes to the action stack for back-button support. The plugin can assign its own `show` if needed.

```typescript
$page.show = () => {
  const actionStack = acode.require('actionStack');
  actionStack.push({
    id: 'plugin-id',
    action: $page.hide,
  });
  app.append($page);
};
```

**Note on `setTitle` vs `settitle`:** The official docs show `setTitle(title)`. The plugin codebase uses `$page.settitle('OpenCode')`. Both should work — Acode is generally lenient with casing.

---

## 3. Terminal API

### `acode.require('terminal')` — Terminal Management

#### Creating Terminals

```typescript
const terminal = acode.require('terminal');

// General create
const term = await terminal.create({ name: 'Shell', theme: 'dark' });

// Local-only (no backend shell)
const local = await terminal.createLocal({ name: 'Output' });

// Server-connected (Alpine Linux backend)
const server = await terminal.createServer({ name: 'Server' });
```

**TerminalOptions:** `name`, `serverMode`, `port` (default 8767), `theme`, `rows`, `cols`, `renderer` (`'auto'`/`'webgl'`/`'canvas'`), `fontSize`, and standard xterm.js options (`fontFamily`, `cursorBlink`, `scrollback`, etc.).

#### Return Value

Each `create*()` method returns:
```typescript
{ id, name, component, file, container }
```

#### Management

```typescript
terminal.get(id)           // Get by id or null
terminal.getAll()          // Map-like collection of all terminals
terminal.write(id, data)   // Write text (ANSI supported) — include \r or \r\n to submit
terminal.clear(id)         // Clear screen
terminal.close(id)         // Close and dispose
```

#### Themes

```typescript
terminal.themes.register(name, theme, pluginId)
terminal.themes.unregister(name, pluginId)
terminal.themes.get(name)
terminal.themes.getAll()
terminal.themes.getNames()
terminal.themes.createVariant(baseName, overrides)
```

Theme layout requires: `background`, `foreground`, `cursor`, `cursorAccent`, `selection`, and 16 ANSI colors (`black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `brightBlack`, ..., `brightWhite`).

### `Executor` — Background Command Execution

**Globally available** — no `require()` needed.

```typescript
Executor.execute(command: string, alpine?: boolean): Promise<string>
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `command` | `string` | — | Shell command to run |
| `alpine` | `boolean` | `true` | Run inside Alpine sandbox; `false` = Android env |

**Returns:** `Promise<string>` — resolves with stdout, rejects with error/stderr.

**Critical behavior:**
- **Blocking.** Resolves only after the command exits.
- **For long-running processes** (servers), always use `nohup ... & disown`.
- **No streaming.** Output comes all at once after completion.
- **Executing is hidden.** No visible terminal UI.

### `Terminal.isInstalled()` (Global)

```typescript
Terminal.isInstalled(): Promise<boolean>
```

Returns `true` if the Alpine terminal runtime has been downloaded/extracted. Useful for checking before using terminal-backed features.

---

## 4. Commands API

### `acode.require('commands')`

Preferred command API (over legacy `editorManager.editor.commands.*`).

```typescript
const commands = acode.require('commands');

// Register
commands.addCommand({
  name: 'example.sayHello',           // unique id (required)
  description: 'Say hello',            // palette label (optional)
  bindKey: { win: 'Ctrl-Alt-H', mac: 'Command-Alt-H' },  // keybinding (optional)
  exec: (view, args) => {              // handler (required)
    return true;                       // return false to keep palette open
  },
});

// Remove
commands.removeCommand('example.sayHello');
```

**Registry (low-level):**
```typescript
commands.registry.add(descriptor)
commands.registry.remove(name)
commands.registry.execute(name, view?, args?)
commands.registry.list()   // Returns array of { name, description, bindKey, exec }
```

**Convenience on `acode`:**
```typescript
acode.addCommand(descriptor)
acode.removeCommand(name)
acode.execCommand(name, view?, args?)
acode.listCommands()
```

---

## 5. Side Button API (v316+)

### `acode.require('sideButton')`

Creates a vertical button on the right side of the editor.

```typescript
const SideButton = acode.require('sideButton');

const btn = SideButton({
  text: 'OpenCode',
  icon: 'my-icon-class',          // CSS icon class
  onclick: () => { /* handler */ },
  backgroundColor: '#fff',
  textColor: '#000',
});

btn.show();   // Show the button
btn.hide();   // Hide the button
```

**Visual behavior:** The button text is rendered vertically. Uses the icon class for the icon portion.

---

## 6. SideBar Apps API

### `acode.require('sidebarApps')`

Adds custom mini-apps to the sidebar panel.

```typescript
const sideBarApps = acode.require('sidebarApps');

sideBarApps.add(
  'icon-class',           // Icon class name
  'my-app-id',            // Unique app ID
  'My App Title',         // Display title
  (container) => {        // Init function — called once on first open
    container.innerHTML = '<div>Content</div>';
  },
  false,                  // prepend: true = add to start, false = end
  (container) => {        // onSelected — called every time tab is selected
    console.log('app selected');
  }
);

// Other methods
sideBarApps.get('my-app-id')      // Returns container HTMLElement
sideBarApps.remove('my-app-id')   // Removes the app
```

**For scrolling:** Add `className = 'scroll'` + set `maxHeight` and `overflowY: auto` on the scrollable element.

---

## 7. EditorManager

### `editorManager` (global)

#### `editorManager.editor`
The active **CodeMirror 6 `EditorView`** instance.

```typescript
const text = editorManager.editor.state.doc.toString();
const view = editorManager.editor;
view.dispatch({
  changes: { from: 0, to: view.state.doc.length, insert: 'new text' },
});
```

**Compatibility helpers** (for legacy Ace plugins):
- `editor.session`
- `editor.getValue()`, `editor.insert(text)`
- `editor.gotoLine(row, col)`
- `editor.getCursorPosition()`, `editor.moveCursorToPosition({row, column})`
- `editor.selection.getRange()`
- `editor.getCopyText()`

#### `editorManager.activeFile: object`
Current file data (includes `uri`, `id`, `name`, etc.).

#### `editorManager.files: Array<object>`
List of all open files.

#### `editorManager.addNewFile(filename?, options?)`
Adds a new file. Options: `text`, `isUnsaved`, `render`, `id`, `uri`, `record`, `deletedFile`, `readOnly`, `mode`, `type`, `encoding`, `onsave`.

#### `editorManager.getFile(test, type)`
Finds a file by `id` / `uri` / `name` / `git` / `gist`.

#### `editorManager.switchFile(id)`
Switches the active tab.

#### `editorManager.hasUnsavedFiles(): number`
Count of unsaved files.

#### `editorManager.container: HTMLElement`
Editor container DOM element.

### Events

```typescript
editorManager.on('switch-file', listener)
editorManager.off('switch-file', listener)
editorManager.emit('my-event', ...args)
```

Event list: `switch-file`, `rename-file`, `save-file`, `file-loaded`, `file-content-changed`, `add-folder`, `remove-folder`, `new-file`, `init-open-file-list`, `update`.

---

## 8. Action Stack API

### `acode.require('actionStack')`

Manages back button navigation via LIFO stack.

```typescript
const actionStack = acode.require('actionStack');

// Push (adds to back button stack)
actionStack.push({
  id: 'unique-id',
  action: () => { /* cleanup and hide */ },
});

// Pop (execute + remove most recent)
actionStack.pop();
actionStack.pop(3);  // pop multiple

// Query
actionStack.get('id')       // Returns action or undefined
actionStack.has('id')       // Returns boolean
actionStack.remove('id')    // Remove without executing (returns boolean)

// Markers
actionStack.setMark()       // Mark current position
actionStack.clearFromMark() // Remove all actions added since mark
```

---

## 9. UI Components

### Toast

```typescript
const toast = acode.require('toast');
toast('Hello!', 3000);           // message, duration in ms
// or globally:
window.toast('Hello!', 3000);
```

### Loader

```typescript
const loader = acode.require('loader');
loader.show('Loading...');   // show with message
loader.hide();               // hide
```

### Prompts/Dialogs

```typescript
acode.alert('Title', 'Message');
acode.confirm('Title', 'Message', callback);  // callback receives boolean
acode.prompt('Title', 'Message', defaultValue, callback);  // callback receives string
```

---

## 10. URL Utilities

### `acode.require('Url')`

```typescript
const Url = acode.require('Url');

Url.basename(url)         // e.g., 'index.html'
Url.dirname(url)          // e.g., 'ftp://localhost/foo/'
Url.extname(url)          // e.g., '.html'
Url.pathname(url)         // e.g., '/foo/bar'
Url.join(...parts)        // Join URL segments
Url.parse(url)            // → { url, query }
Url.formate(urlObj)       // URL object → string
Url.getProtocol(url)      // → 'ftp:' | 'sftp:' | 'http:' | 'https:'
Url.areSame(...urls)      // Compare URLs
Url.safe(url)             // URL-encode components
Url.hidePassword(url)     // Password → ****
Url.decodeUrl(url)        // → { username, password, hostname, pathname, port, query }
Url.trimSlash(url)        // Remove trailing slash
```

---

## 11. Global Utilities

### Storage Paths (read-only globals)

| Variable | Description |
|----------|-------------|
| `ASSETS_DIRECTORY` | App assets directory |
| `CACHE_STORAGE` | Cache files directory |
| `DATA_STORAGE` | App data directory |
| `PLUGIN_DIR` | Plugins directory |
| `KEYBINDING_FILE` | Keybinding file path |

### Feature Flags

| Variable | Description |
|----------|-------------|
| `DOES_SUPPORT_THEME` | Theme support available |
| `IS_FREE_VERSION` | Running free version |
| `ANDROID_SDK_INT` | Android SDK level (number) |

---

## 12. `plugin.json` Manifest

Required for every plugin. Key fields:

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier (reverse domain convention) |
| `name` | Yes | Plugin display name |
| `main` | Yes | Path to bundled JS entry file (e.g., `"dist/main.js"`) |
| `version` | Yes | Semantic version; increment for updates |
| `readme` | No | Path to readme.md |
| `icon` | No (recommended) | Path to icon.png (≤50KB) |
| `files` | No | Array of additional files to include in zip |
| `minVersionCode` | No | Minimum Acode version (use `290` as safe minimum) |
| `price` | No | INR 0–10000 (0 or omitted = free) |
| `license` | No | License name |
| `keywords` | No | Searchable terms |
| `changelogs` | No | Path to changelog file |
| `repository` | No | Git URL (free plugins) |
| `author` | No | `{ name, email, url, github }` |

---

## 13. Plugin Lifecycle Reference

```
1. Acode discovers plugin folders
2. Decides which to load (enabled, not broken, not already loaded)
3. Loads entry script (main.js)
4. Calls registered init(baseUrl, $page, options)
5. On disable/uninstall/reload → calls registered unmount()
```

**Failure behavior:** If plugin throws during init, it's marked as broken. Use `acode.clearBrokenPluginMark(id)` for recovery.

**Best practices:**
- Keep `init()` fast; defer heavy work
- Always register an `unmount` that removes commands, listeners, intervals, and UI hooks
- `init` should be repeatable (disable → enable runs it again)
- Register commands via `acode.require('commands')` not legacy `editorManager.editor.commands`
