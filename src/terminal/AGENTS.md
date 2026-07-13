# src/terminal

## Purpose

Thin typed wrapper over `acode.require('terminal')`. Single-export module that decouples the rest of the plugin from Acode's terminal internals.

## Ownership

Owned by the root AGENTS.md. Single file: `executor.ts`.

## Local Contracts

- `execute(command, alpine = true): Promise<string>` — resolves with command output on success, rejects on non-zero exit. On rejection, the thrown error includes the original message and any captured command output: `"Command failed: <original message>\nOutput: <output>"`. If no output is available, the error is `"Command failed: <original message>"`.
- **Blocking by nature.** Acode's terminal `Executor.execute` resolves only after the command exits. Callers of long-running commands MUST use `nohup ... & disown` — never pass a persistent command directly.
- Untyped Acode module accessed via `acode.require('terminal') as any` — this is the established pattern. The `Executor` interface used in the type annotation is global (provided by acode-plugin-types).
- `alpine` parameter defaults to `true` (all commands execute inside Alpine Linux).

## Work Guidance

- Do not add business logic here. This module translates Acode's async terminal API into a simple promise.
- If the underlying Acode terminal API changes, update only this file.

## Verification

No automated tests. Tested implicitly through the server lifecycle in main.ts.

## Child DOX Index

None. Single-file directory, leaf in the DOX hierarchy.
