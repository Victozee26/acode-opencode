# src/terminal

## Purpose

Thin typed wrapper over the global `Executor`. Single-export module that decouples the rest of the plugin from Acode's terminal internals.

## Ownership

Owned by the root AGENTS.md. Single file: `executor.ts`.

## Local Contracts

### `execute(command, alpine = true): Promise<string>`

Blocking command execution. Resolves with command output on success, rejects on non-zero exit. On rejection, the thrown error includes the original message and any captured command output: `"Command failed: <original message>\nOutput: <output>"`. If no output is available, the error is `"Command failed: <original message>"`.

### `startBackground(command, onData?, alpine = true): Promise<BackgroundProcess>`

Launches a persistent process via `Executor.BackgroundExecutor.start()`. Unlike `execute`, the returned promise resolves with a `BackgroundProcess` handle (containing `uuid`) once launched — it does NOT wait for the process to exit. The optional `onData` callback receives typed output chunks (`stdout`, `stderr`, `exit`, `unknown`). The returned `BackgroundProcess` exposes `stop()`, `isRunning()`, and `write(input)` methods.

### `stopBackground(uuid): Promise<string>`

Stops a persistent background process by UUID via `Executor.BackgroundExecutor.stop()`.

### `isBackgroundRunning(uuid): Promise<boolean>`

Checks whether a persistent background process is still alive via `Executor.BackgroundExecutor.isRunning()`.

### `writeBackground(uuid, input): Promise<string>`

Writes input to a persistent background process's stdin via `Executor.BackgroundExecutor.write()`.

### `executeVerbose(command, onProgress?, alpine = true): Promise<string>`

Runs a command as a background process and streams its output in real-time via the optional `onProgress` callback while waiting for exit. Resolves with full accumulated stdout on success, rejects with exit code and captured output on failure. Used for installation commands where live UI feedback is desired (npm install output, apk add progress).

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
