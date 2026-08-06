# Architecture

## Core seam

```text
feature module
  ├─ command descriptors ──> parser registration
  │                       ├─> human help and examples
  │                       ├─> schema / describe
  │                       ├─> Markdown command reference
  │                       └─> shell completions
  ├─ service providers ───> lazy typed per-run service registry
  └─ doctor checks ───────> fast offline diagnostics

handler ──> typed outcome ──> human renderer | JSON | JSONL
```

Commander is an implementation detail behind the descriptor binder. Feature code never imports it. The grammar can therefore remain mature while the catalogue, services, docs, and future protocol surfaces stay framework-independent.

## Layers

### Engine

`src/engine/` owns command registration, parsing, lifecycle, signals, lazy services, help, presentation, errors, machine output, catalogue generation, and completion generation.

It has no feature or product knowledge.

### Modules

`src/modules/` contains statically imported feature slices:

- `system`: version, doctor, schema, describe, and completion;
- `api`: endpoint discovery and raw HTTP plumbing; and
- `items`: a disposable example of higher-level commands over the API client.

A generated CLI deletes or replaces feature modules while retaining the engine. Static imports keep standalone Bun builds deterministic.

### Services

Commands request services through typed tokens. Providers construct lazily inside one CLI run, may depend on other providers, and may register disposal callbacks.

This gives commands a small execution context without globals, an application container, or eager startup work. Both the raw API command and polished resource commands resolve the same API-client token, so authentication, timeout, error normalisation, and origin protection cannot drift.

### Presentation

Handlers return data. Human renderers turn validated data into terminal text. JSON and JSONL bypass human layout and serialize the same validated values.

The theme exposes semantic roles instead of raw colours. Status wording, method labels, and symbols remain present when colour is disabled.

## Execution lifecycle

1. Preflight scans universal presentation flags so usage errors respect machine and colour modes.
2. The descriptor catalogue is validated for duplicate paths and aliases.
3. Commander binds the catalogue and parses argv.
4. One abort controller listens for `SIGINT` and `SIGTERM`.
5. The selected handler resolves only the services it uses.
6. Options, inputs, and outputs pass through boundary schemas.
7. The engine renders exactly one outcome.
8. Services dispose in reverse construction order.
9. The entry point sets `process.exitCode`; command code never exits directly.

## Human and headless behaviour

Interactive execution requires human output, TTY input and diagnostics, no CI marker, and no explicit non-interactive flag. Every prompt has a complete flag-based route. A write that needs confirmation fails with `action_required` and a copy-pasteable retry hint when interaction is unavailable.

Clack is loaded lazily for all prompts: short text and confirmation prompts, and autocomplete search over large catalogues. Prompts are presentation adapters; commands retain complete flag-based routes.

## REST plumbing and polished commands

The `api` module owns a fixed-origin client. It supports repeated headers, typed and string body fields, file or stdin bodies, response headers, silent checks, and safe curl generation.

Interactive discovery searches the route manifest across method, path, operation ID, summary, description, and tags. It shows a stable protocol colour for every method, resolves path parameters, and confirms selected mutations. An OpenAPI loader can later replace the static manifest without changing the command or picker contracts.

`items` demonstrates how a product command reuses that client while providing stronger schemas, a focused human renderer, and explicit write safety. It is sample code and should be replaced.

## Intentionally absent

- in-process third-party plugins;
- a full-screen TUI;
- implicit telemetry;
- automatic shell configuration edits;
- an automatic update mechanism;
- protocol servers before a consumer needs them;
- decorative table borders; and
- runtime filesystem scanning for commands in compiled executables.

Feature modules are imported statically so Bun can compile one deterministic executable. Lazy service construction provides most startup benefits without a dynamic command loader.
