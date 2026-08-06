---
name: cli-template
description: Use when operating or extending a CLI created from this Bun and TypeScript template, including command discovery, safe API calls, structured output, and repository validation.
---

# CLI Template skill

This is an example operating skill for CLIs created from this repository. After renaming the template, replace the name, examples, environment variables, authentication guidance, and resource nouns with the real product contract.

## Use this skill when

- discovering what the CLI can do;
- calling commands from an agent or automation;
- exploring a configured REST API;
- making a guarded write;
- diagnosing local CLI configuration; or
- adding a command, module, service, or API operation to this repository.

Do not use this file as a substitute for command discovery. The descriptor catalogue is the source of truth.

## Discover commands

Start with the cheapest relevant surface:

```bash
cli-template --help
cli-template <group> --help
cli-template schema --json
cli-template describe <command path>
```

Use `schema --json` when selecting commands programmatically. Use `describe` when the path is known but arguments, flags, examples, or write classification need inspection.

For API operations:

```bash
cli-template api ls --json
cli-template api ls --filter <query> --json
cli-template api describe <METHOD> <PATH> --json
```

## Prefer headless execution

When an agent invokes the CLI:

- pass `--json` for one bounded result;
- pass `--jsonl` only for an event-producing command;
- pass `--non-interactive` when human prompts must be impossible;
- set `NO_COLOR=1` when capturing human text;
- read stdout as data and stderr as diagnostics; and
- branch on exit status and stable error code, not message text.

Never send prompt keystrokes as the primary automation route.

## Reads and writes

Read commands can normally run directly:

```bash
cli-template version --json
cli-template doctor --json
cli-template items list --json
cli-template api /health --json
```

Preview write commands first when `--dry-run` exists:

```bash
cli-template items create "Example" --dry-run --json
```

Only apply after the plan matches the user's request:

```bash
cli-template items create "Example" --yes --json
```

Do not add `--yes` merely to make an error disappear. Confirm the target, scope, and payload first. Interactive selection may ask for confirmation, but agent execution should use the explicit flag route.

## API usage

The raw API command uses the same fixed-origin client as polished commands:

```bash
cli-template api /health --json
cli-template api /items -X POST -F name=Example --json
cli-template api /items/item-1 -X PATCH -F status=archived --json
cli-template api /items/item-1 -X DELETE --json
```

Generate a redacted curl command without sending the request:

```bash
cli-template api /items -X POST -F name=Example --generate curl
```

Configuration placeholders:

```bash
export CLI_TEMPLATE_BASE_URL=https://api.example.com
export CLI_TEMPLATE_TOKEN=replace-me
```

The client must attach credentials only to the configured origin. Never print, persist, or place real credentials in generated examples.

## Handle failures

For an expected error:

1. read the exit status;
2. parse the structured error code when JSON mode is active;
3. inspect `hint` or `details`;
4. correct the input or configuration; and
5. retry the exact intended command.

Useful diagnostics:

```bash
cli-template doctor --json
cli-template version --json
cli-template describe <command path>
```

Do not expose environment values or credentials while reporting diagnostics.

## Extend the repository

Before editing:

1. read `AGENTS.md`;
2. read `docs/architecture.md`;
3. inspect the nearest module and its tests; and
4. keep the change at the owning command, service, or presentation seam.

Add a command with `defineCommand`. Add a feature group with `defineModule`. Place shared I/O or lifecycle behaviour behind a typed service token. Attach the module statically in `src/app.ts`.

Maintain these invariants:

- a command is declared once;
- handlers return typed outcomes and do not print;
- stdout contains data, while stderr contains diagnostics;
- options and output cross Zod schemas;
- machine and non-interactive modes never prompt or animate;
- colour uses semantic UI roles and remains optional;
- expected errors use stable codes and recovery hints;
- writes have an explicit headless confirmation route; and
- credentials remain redacted and origin-bound.

The full implementation guide is `docs/extending.md`.

## Validate changes

Run the complete gate:

```bash
bun run ci
```

For presentation or prompt changes, also test:

```bash
NO_COLOR=1 bun run dev -- --help
bun run dev -- api
```

For release-sensitive changes:

```bash
bun run build:release
```

Generated `docs/commands.md` must be committed.

## Customise this skill

Before shipping a generated CLI:

- rename the frontmatter `name`;
- make `description` specific enough to trigger only for the product;
- replace every `cli-template` and `CLI_TEMPLATE` placeholder;
- remove the disposable `items` examples;
- document real login, config, and environment precedence;
- list the safest high-value read workflows;
- document each guarded write and its dry-run route;
- add stable error recovery that callers routinely need;
- link product-specific reference files instead of copying large content here; and
- run the target agent system's skill validator if one is available.
