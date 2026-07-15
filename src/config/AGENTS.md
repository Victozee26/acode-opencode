# src/config

## Purpose

Single source of truth for every named constant in the plugin: network/server values, OpenCode CLI lifecycle commands and timeouts, health-probe and diagnostic values, UI rendering constants, and the global debug switch. No logic, no side effects — pure constants only.

## Ownership

Owned by the root AGENTS.md. Seven files:
- `server.ts` — network/server core: `PORT`, `HOSTNAME`, `BASE_URL`, `LOG_PATH` (leaf, imports nothing).
- `opencode.ts` — OpenCode lifecycle: install/start/stop/readiness commands and timeouts (`INSTALL_DEPS_COMMAND`, `INSTALL_OPENCODE_COMMAND`, `CHECK_COMMAND`, `STARTUP_CHECK_DELAY`, `READY_POLL_INTERVAL`, `READY_TIMEOUT`, `KILL_COMMAND`, `HARD_KILL_COMMAND`, `PROCESS_CHECK_COMMAND`, `STOP_POLL_TIMEOUT`, `STOP_POLL_INTERVAL`).
- `health.ts` — health probe + diagnostics: `HEALTH_CHECK_URL` (derives from `BASE_URL` in `server.ts`), `HEALTH_CHECK_TIMEOUT`, `LOG_TAIL_LINES`, `ERROR_FALLBACK_MESSAGE`.
- `ui.ts` — rendering constants: `SPINNER_DEG_PER_SEC`, `SPINNER_FPS`, `FLOATING_BUTTON_IDLE_OPACITY_TIMEOUT`, `FAB_SCRIM_BACKGROUND`, `FAB_SCRIM_BLUR`, `FAB_SCRIM_Z_INDEX`, `FAB_Z_INDEX`.
- `app.ts` — global debug master switch: `DEBUG`.
- `index.ts` — barrel re-exporting every sub-module (`export *`). Convenience for tests; source consumers import the specific sub-module directly.

## Local Contracts

- Every constant is exported as a named `const` — no magic numbers/strings anywhere else in the codebase.
- `config/` is a leaf package of pure constants. Sub-modules import nothing outside `config/`. Cross-config imports (e.g. `health.ts` ← `server.ts` for `BASE_URL`) are allowed; no imports from `../opencode`, `../ui`, `../terminal`, etc.
- `PORT` is fixed at `4096` and `HOSTNAME` is loopback `127.0.0.1` (hard constraint — never `0.0.0.0` without auth). `BASE_URL` and `HEALTH_CHECK_URL` derive from them, so change the source constants rather than the derived URLs.
- Consumers import from the specific sub-module (`../config/server`, `../config/opencode`, `../config/health`, `../config/ui`, `../config/app`), not the barrel, except tests which may use `../config` (resolves to `index.ts`).

## Work Guidance

- Add a new constant to the sub-module matching its domain; create a new sub-module only if a genuinely new domain appears. Keep the barrel `index.ts` re-exporting it.
- Never inline raw literals in `src/`. If you add a literal, it belongs here first.
- Do not introduce logic, builders, or runtime computation beyond `const` expressions in this folder.

## Verification

No dedicated test file — constants are exercised indirectly by every other suite (`npm test`, Vitest + jsdom). `npm run build` (tsc `--noEmit`) enforces that all constants exist and are typed.

## Child DOX Index

None. This directory is a leaf in the DOX hierarchy.
