# src/config

## Purpose

Single source of truth for every named constant in the plugin: network/server values, OpenCode CLI lifecycle commands and timeouts, health-probe and diagnostic values, UI rendering constants, and the global debug switch. No logic, no side effects — pure constants only.

## Ownership

Owned by the root AGENTS.md. Ten files:
- `server.ts` — network/server core: `PORT`, `HOSTNAME`, `BASE_URL` (leaf, imports nothing), plus serve-auth values `SERVER_USERNAME`, `SERVER_PASSWORD_ENV`, `AUTH_TOKEN_PARAM`.
- `auth.ts` — V2 auth values: `PASSWORD_BYTE_LENGTH`, `V2_MAJOR_VERSION`, `BASIC_AUTH_SCHEME` (leaf, imports nothing).
- `opencode.ts` — OpenCode lifecycle: install/start/stop/readiness commands and timeouts (`NPM_VERSION_COMMAND`, `NODE_VERSION_COMMAND`, `RUNTIME_VERSION_PROBE_TIMEOUT`, `VERSION_PENDING`, `VERSION_UNKNOWN`, `NPM_ALLOW_SCRIPTS_MIN_VERSION`, `INSTALL_DEPS_COMMAND`, `INSTALL_OPENCODE_COMMAND`, `INSTALL_OPENCODE_COMMAND_ALLOW_SCRIPTS` (V2 `@opencode/cli` package), `CHECK_COMMAND`, `UNINSTALL_COMMAND` (both V1 + V2 packages), `READY_POLL_INTERVAL`, `READY_TIMEOUT`, `SERVER_LOG_LINES`, `SERVER_LOG_NOISE_PREFIXES`, `KILL_COMMAND`, `HARD_KILL_COMMAND`, `PROCESS_CHECK_COMMAND`, `STOP_POLL_TIMEOUT`, `STOP_POLL_INTERVAL`).
- `health.ts` — health probe + diagnostics: `HEALTH_CONFIG_PATH` / `HEALTH_CHECK_PATH` (the API paths, relative to any server base URL), `HEALTH_CHECK_URL` (V1 `/global/health` route, derives from `BASE_URL` in `server.ts`), `HEALTH_CONFIG_URL` (V2 `/api/config` API root, derives from `BASE_URL`), `HEALTH_STATUS_UNAUTHORIZED`, `HEALTH_STATUS_SUCCESS_MIN`/`HEALTH_STATUS_SUCCESS_MAX`, `HEALTH_RESPONSE_TYPE`, `HEALTH_WATCHDOG_MARGIN`, `HEALTH_CHECK_TIMEOUT`, `ERROR_FALLBACK_MESSAGE`, `HEALTH_PROBE_INTERVAL`, `HEALTH_CRASH_CONFIRM_ATTEMPTS`, `HEALTH_CRASH_RETRY_INTERVAL`, `HEALTH_CONNECTION_LOST_MESSAGE`.
- `ui.ts` — rendering constants: `SPINNER_DEG_PER_SEC`, `SPINNER_FPS`, `FLOATING_BUTTON_IDLE_OPACITY_TIMEOUT`, `FAB_SCRIM_BACKGROUND`, `FAB_SCRIM_BLUR`, `FAB_SCRIM_Z_INDEX`, `FAB_Z_INDEX`, `HEADER_CONTAINER_ID`, `CONTENT_CONTAINER_ID`, `HEADER_LANDSCAPE_HIDDEN_CLASS`, `LANDSCAPE_MEDIA_QUERY`.
- `app.ts` — legacy global debug master switch: `DEBUG` (kept for backward compat; runtime control is via `logLevel` setting, `none` disables).
- `settings.ts` — iframe scale, log-level, and hide-header-in-landscape setting constants: `SETTINGS_KEY_IFRAME_SCALE`, `DEFAULT_IFRAME_SCALE`, `IFRAME_SCALE_MIN`, `IFRAME_SCALE_MAX`, `IFRAME_SCALE_STEP`, `SETTINGS_KEY_LOG_LEVEL`, `DEFAULT_LOG_LEVEL`, `SETTINGS_KEY_HIDE_HEADER_IN_LANDSCAPE`, `DEFAULT_HIDE_HEADER_IN_LANDSCAPE`.
- `remote.ts` — remote OpenCode host constants: `SETTINGS_KEY_REMOTE_HOST`, `REMOTE_DEFAULT_HTTP_PORT`, `REMOTE_DEFAULT_HTTPS_PORT`, `REMOTE_SCHEME_HTTP`, `REMOTE_SCHEME_HTTPS`, `REMOTE_SCHEME_SEPARATOR`, `REMOTE_HOST_PORT_SEPARATOR`, `REMOTE_BRACKET_OPEN`/`REMOTE_BRACKET_CLOSE`, `REMOTE_PORT_MIN`/`REMOTE_PORT_MAX`, `REMOTE_HOST_PATTERN`, `REMOTE_PORT_PATTERN`, plus the user-facing remote-flow messages (`REMOTE_INVALID_HOST_MESSAGE`, `REMOTE_UNREACHABLE_MESSAGE`, `REMOTE_BAD_PASSWORD_MESSAGE`, `REMOTE_PROMPT_TITLE`, `REMOTE_PROMPT_MESSAGE`, `REMOTE_PROMPT_PLACEHOLDER`).
- `update.ts` — update commands: `VERSION_CHECK_COMMAND` (`opencode --version`), `LATEST_VERSION_COMMAND` (`npm view @opencode/cli version`, V2 track — V1 installs are offered migration), `INSTALL_UPDATE_COMMAND` (`npm install -g @opencode/cli`), `INSTALL_UPDATE_COMMAND_ALLOW_SCRIPTS` (`npm install -g --allow-scripts=@opencode/cli @opencode/cli`), `UNINSTALL_V1_COMMAND` (`npm uninstall -g opencode-ai`, best-effort pre-update migration cleanup).
- `index.ts` — barrel re-exporting every sub-module (`export *`). Convenience for tests; source consumers import the specific sub-module directly.

## Local Contracts

- Every constant is exported as a named `const` — no magic numbers/strings anywhere else in the codebase.
- `config/` is a leaf package of pure constants. Sub-modules import nothing outside `config/`. Cross-config imports (e.g. `health.ts` ← `server.ts` for `BASE_URL`) are allowed; no imports from `../opencode`, `../ui`, `../terminal`, etc.
- `PORT` is fixed at `4123` (not the upstream default `4096`, to avoid clashing with manually started servers) and `HOSTNAME` is loopback `127.0.0.1` (hard constraint — never `0.0.0.0` without auth). `BASE_URL` and the probe URLs derived from it (`HEALTH_CHECK_URL`, `HEALTH_CONFIG_URL`) follow the source constants, so change the source constants rather than the derived URLs. The probe paths (`HEALTH_CONFIG_PATH`, `HEALTH_CHECK_PATH`) are relative, so the same probe works against a remote base URL.
- The remote host is user input: `REMOTE_HOST_PATTERN` and `REMOTE_PORT_PATTERN` bound what the plugin accepts, and `REMOTE_PORT_MIN`/`REMOTE_PORT_MAX` bound the port range. Parsing lives in `src/opencode/remote.ts`; this file only holds the accepted shapes and limits.
- Consumers import from the specific sub-module (`../config/server`, `../config/opencode`, `../config/health`, `../config/ui`, `../config/app`), not the barrel, except tests which may use `../config` (resolves to `index.ts`).

## Work Guidance

- Add a new constant to the sub-module matching its domain; create a new sub-module only if a genuinely new domain appears. Keep the barrel `index.ts` re-exporting it.
- Never inline raw literals in `src/`. If you add a literal, it belongs here first.
- Do not introduce logic, builders, or runtime computation beyond `const` expressions in this folder.

## Verification

No dedicated test file — constants are exercised indirectly by every other suite (`npm test`, Vitest + jsdom). `npm run build` (tsc `--noEmit`) enforces that all constants exist and are typed.

## Child DOX Index

None. This directory is a leaf in the DOX hierarchy.
