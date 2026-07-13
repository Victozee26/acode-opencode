# AGENTS.md

## Build commands

```
npm run build      # typecheck (tsc --noEmit) → esbuild bundle + zip
npm run dev        # typecheck → esbuild watch + serve on port 3000
```

Build order matters: typecheck must pass before esbuild runs. Output is `dist/main.js` → automatically zipped to `dist.zip` (the plugin artifact).

## Architecture

Acode plugin (Android WebView) that launches OpenCode as a background HTTP server inside Acode's built-in Alpine Linux terminal, then embeds its web UI in an iframe.

**Entrypoint:** `src/main.ts` → `AcodePlugin` class.

**Directory layout** (feature-based):
```
src/
  main.ts               # plugin init/destroy, flow orchestration
  types.ts              # AppState enum, StateContext, ErrorInfo
  state.ts              # state machine (transition, onStateChange, reset)
  config.ts             # all named constants (port, URLs, commands, status messages)
  project.ts            # resolveProjectPath()
  terminal/executor.ts  # thin wrapper over acode.require('terminal')
  opencode/install.ts   # checkInstalled, installOpenCode
  opencode/server.ts    # isServerUp, startServer, stopServer, restartForProject
  ui/index.ts           # render() orchestrator, one render func per state
  ui/components.ts      # DOM factory functions (spinner, iframe, header, error)
```

**State machine** (`src/types.ts` — `AppState` enum): `Idle → CheckingInstall → Installing → CheckingServer → ResolvingPath → StartingServer → Ready`. Error can be entered from any state. UI is purely reactive via `onStateChange` listener.

## Hard constraints (non-negotiable)

- **Alpine-native paths only.** `content://` URIs (SAF) are rejected in `resolveProjectPath()`. Projects must be cloned/created inside Alpine's filesystem.
- **Fixed port 4096, loopback only.** `opencode serve --port 4096 --hostname 127.0.0.1`. Never bind to `0.0.0.0` without adding auth.
- **Executor.execute is blocking.** The terminal module resolves only after the command exits. All long-running commands (server start) MUST use `nohup ... & disown` — never call `execute()` without this pattern for persistent processes.
- **Single server, single project.** Switching projects means restarting the one server, not spawning a second instance.

## Code conventions

- **No magic numbers/strings.** All constants live in `src/config.ts`. Import them — never inline literals.
- **ESLint rules** (enforced when eslint is installed): `max-depth: 3`, `max-lines-per-function: 40` (warn), `no-magic-numbers` (warn, except 0,1,-1), `prefer-const`, `no-var`.
- **Prettier** (when installed): single quotes, trailing commas, 100 char width, 2-space tabs.
- **Untyped Acode modules** use `acode.require('...') as any` — this is the established pattern (acode-plugin-types doesn't cover all runtime modules).
- **State handling** uses the `AppState` enum and `transition()` instead of nested conditionals. Never add a state check without adding it to the enum.
- **Imports:** `config.ts` imports `AppState` from `types.ts` at the bottom of the file — be mindful of import order; keep this pattern to avoid issues.

## Gotchas

- `eslint` and `prettier` packages are **not installed** (configs exist but are inert). Install them before running lint/format.
- No test framework exists. Testing is manual (see `BUILD_PLAN.md` Phase 5 for the QA matrix).
- `plugin.json` has placeholder values (`id`, `name`, `author`) that need real values before publishing.
- `html-tag-js` is listed as a dependency but currently unused — all DOM is vanilla `document.createElement`.
- Health-check uses `fetch(..., { mode: 'no-cors' })` with `AbortController` timeout — not a standard HTTP check. Do not change this to a normal fetch without understanding the CORS implications in the WebView context.

# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

## Child DOX Index

- `src/opencode/AGENTS.md` — OpenCode lifecycle: install checks, installation, server start/stop/restart, health polling.
- `src/ui/AGENTS.md` — DOM rendering layer: render orchestrator per state, vanilla DOM component factories.
- `src/terminal/AGENTS.md` — Terminal abstraction wrapping `acode.require('terminal')`.
- `src/main.ts`, `src/types.ts`, `src/state.ts`, `src/config.ts`, `src/project.ts` — Cross-cutting infrastructure owned directly by root AGENTS.md.
