# src/terminal

## Purpose

Thin typed wrapper over the global `Executor`. Single-export module that decouples the rest of the plugin from Acode's terminal internals.

## Ownership

Owned by the root AGENTS.md. Single file: `executor.ts`.

## Local Contracts

### `execute(command, alpine = true): Promise<string>`

Blocking command execution. Resolves with command output on success, rejects on non-zero exit. On rejection, the thrown error includes the original message and any captured command output: `"Command failed: <original message>\nOutput: <output>"`. If no output is available, the error is `"Command failed: <original message>"`.

### `startProcess(command, onData?, alpine = true): Promise<ProcessHandle>`

Launches a persistent process via `Executor.start()` — the **foreground** executor, so Acode keeps the process alive under a foreground service even after the app leaves the foreground. Acode's background executor (`Executor.BackgroundExecutor`) must not be used for long-lived processes: Android is free to kill those once Acode is backgrounded. Unlike `execute`, the returned promise resolves with a `ProcessHandle` (containing `uuid`) once launched — it does NOT wait for the process to exit. The optional `onData` callback receives typed output chunks (`stdout`, `stderr`, `exit`, `unknown`). The returned `ProcessHandle` exposes `stop()`, `isRunning()`, and `write(input)` methods.

### `stopProcess(uuid): Promise<string>`

Stops a persistent process by UUID via `Executor.stop()`.

### `isProcessRunning(uuid): Promise<boolean>`

Checks whether a persistent process is still alive via `Executor.isRunning()`.

### `writeProcess(uuid, input): Promise<string>`

Writes input to a persistent process's stdin via `Executor.write()`.

### `ensureAlpineAvailable(): Promise<void>`

Fails with an actionable message when Acode's terminal runtime is not installed yet (`Terminal.isInstalled()` reports false), instead of letting `apk`/`npm` fail with an opaque shell error. Called by `execute()` and `startProcess()`. On builds that do not expose `Terminal.isInstalled()` the check is skipped and the command runs.

### `executeVerbose(command, onProgress?, alpine = true): Promise<string>`

Runs a command as a persistent process and streams its output in real-time via the optional `onProgress` callback while waiting for exit. Resolves with full accumulated stdout on success, rejects with exit code and captured output on failure. Used for installation commands where live UI feedback is desired (npm install output, apk add progress).

### General rules

- Uses the globally available `Executor` — no `require()` needed. The `Executor` type is declared globally by `acode-plugin-types`.
- `alpine` parameter defaults to `true` (all commands execute inside Alpine Linux).
- `disown` is not available in BusyBox `ash` (Acode's Alpine shell).
- Error output probing uses a local `ExecutorError` interface (`{ output?: string }`) instead of `Record<string, unknown>` casts.

## Work Guidance

- Do not add business logic here. This module translates Acode's async terminal API into a simple promise.
- If the underlying Acode terminal API changes, update only this file.

## Verification

`npm test` runs Vitest with jsdom. Test file: `test/terminal/executor.test.ts`. Covers success, failure without output, failure with output, and non-Error rejections.

## Child DOX Index

None. Single-file directory, leaf in the DOX hierarchy.
