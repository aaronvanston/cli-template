# Extending the template

This guide covers the decisions and files involved in turning the scaffold into a real CLI.

## 1. Choose the smallest extension seam

Use a standalone command when the feature has no shared infrastructure. Use a module when several commands form one feature. Add a service when commands need shared state, I/O, authentication, storage, or lifecycle cleanup. Extend the API manifest when raw route access and searchable discovery are useful.

Keep feature names concrete. The engine should not learn product nouns.

## 2. Add a command

Create a descriptor with `defineCommand`:

```ts
import { z } from "zod";
import { defineCommand } from "../../engine/index.ts";

export const widgetsListCommand = defineCommand({
  path: ["widgets", "list"],
  aliases: ["ls"],
  module: "widgets",
  summary: "List widgets",
  description: "Reads widgets from the configured service.",
  options: [
    {
      flags: "--limit <count>",
      description: "Maximum number of widgets",
      defaultValue: 20,
    },
  ],
  examples: [
    "cli-template widgets list",
    "cli-template widgets list --limit 5 --json",
  ],
  optionsSchema: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
  outputSchema: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    })
  ),
  async run(context) {
    return { data: [] };
  },
  render(data, context) {
    return context.ui.table(
      ["ID", "Name"],
      data.map((widget) => [widget.id, widget.name])
    );
  },
});
```

The descriptor owns grammar, documentation, validation, execution, and human presentation. Do not add the same command to a second help or docs registry.

### Descriptor checklist

- `path` is the canonical token sequence.
- `aliases` are optional and should remain unambiguous.
- `module` groups commands in root help.
- `summary` is one line; `description` adds context only when needed.
- `arguments` and `options` describe the parser surface.
- `examples` are copy-pasteable and include a machine-mode example.
- `kind` is `write` for mutations and defaults to `read`.
- `optionsSchema` normalises and validates parser values.
- `outputSchema` stabilises the public result contract.
- `run` performs work without printing.
- `render` formats only the human result.

## 3. Attach a module

Group commands in `src/modules/widgets/module.ts`:

```ts
import { defineModule } from "../../engine/index.ts";
import { widgetsListCommand } from "./commands.ts";

export const widgetsModule = defineModule({
  id: "widgets",
  summary: "Manage widgets",
  commands: [widgetsListCommand],
});
```

Import it in `src/app.ts` and add it to `modules`. Modules are static imports so compiled executables do not depend on runtime file discovery.

## 4. Add a typed service

Define a token and provider close to the infrastructure it owns:

```ts
import {
  createServiceToken,
  type ServiceProvider,
} from "../../engine/index.ts";

type WidgetsService = {
  list(limit: number): Promise<readonly Widget[]>;
};

export const widgetsService =
  createServiceToken<WidgetsService>("widgets-service");

export const widgetsServiceProvider: ServiceProvider<WidgetsService> = {
  token: widgetsService,
  create() {
    return new RemoteWidgetsService();
  },
  async dispose(service) {
    await service.close?.();
  },
};
```

Add the provider to its module and resolve it only inside commands that need it:

```ts
const service = await context.services.get(widgetsService);
```

Providers are lazy, cached for one invocation, cycle-checked, and disposed in reverse construction order.

## 5. Model errors at the boundary

Throw `AppError` for expected failures:

```ts
throw new AppError({
  code: "widget_not_found",
  message: `No widget matches "${id}".`,
  exitCode: ExitCode.ERROR,
  hint: `Run '${context.app.meta.name} widgets list'.`,
});
```

Codes are stable automation contracts. Messages and hints are human guidance. Unexpected errors are normalised by the engine.

Validate external data before returning it. A service response, config file, or stdin payload should not leak unchecked values into the command output schema.

## 6. Design writes for both people and automation

A write command should:

1. declare `kind: "write"`;
2. expose all required input as arguments, flags, stdin, or files;
3. support `--dry-run` when it can show a meaningful plan;
4. accept `--yes` or another explicit confirmation flag;
5. prompt only when `context.interactive` is true; and
6. return `action_required` with a retry hint in headless mode.

Keep the dry-run result schema close to the applied result so callers can inspect the same intended operation before sending it.

## 7. Add an interactive prompt

Prompts are adapters; every workflow also has a prompt-free route.

- Load prompt libraries inside the prompt function so headless startup remains fast.
- Pass `context.signal`.
- Use stdin for input and stderr for prompt output.
- Treat cancellation as an expected result or `AppError`.
- Never prompt in JSON, JSONL, CI, piped, or explicit non-interactive modes.
- Provide an equivalent flag route and document it in examples.

Use line prompts for bounded choices. Use searchable selection only when the catalogue is large enough to justify it. A full-screen UI belongs in a separate surface.

## 8. Extend or remove the API module

Replace the examples in `src/modules/api/endpoints.ts` with the product routes. The picker matches:

- HTTP method;
- path;
- operation ID;
- summary;
- description; and
- tags.

Keep `mutates` accurate because interactive selection uses it to confirm writes. The method palette already covers GET, POST, PUT, PATCH, and DELETE.

For a large API, implement a loader that produces `ApiEndpoint[]` from an OpenAPI document. Put download, caching, and authentication behind a service; do not move those concerns into the command engine.

If the product does not expose HTTP, remove `apiModule` and `itemsModule` from `src/app.ts`, delete both module directories, remove the example server, and update tests.

## 9. Add configuration and authentication

Keep configuration precedence explicit and document it. A common order is:

1. command flags;
2. environment variables;
3. a user config file; and
4. compiled defaults.

Put file access and credential retrieval behind services. Redact secrets in errors, debug output, generated commands, and test snapshots. Attach credentials only to an allow-listed origin. Do not rely on implicit `.env` loading in compiled releases.

Add offline `doctor` checks for configuration shape or credential presence. Network health checks should be separate commands so `doctor` stays quick and deterministic.

## 10. Keep output composable

Use the semantic UI helpers for human presentation. Never call `console.log` from a feature module.

- stdout: final data or event records;
- stderr: prompts, diagnostics, warnings, and progress;
- `--json`: one versioned envelope;
- `--jsonl`: one versioned event per line;
- human: borderless, width-aware terminal text.

Add a semantic style role before hardcoding ANSI output in a command. Ensure the plain-text result remains understandable.

## 11. Update discovery and documentation

After changing descriptors:

```bash
bun run docs
bun run dev -- --help
bun run dev -- schema --json
bun run dev -- describe widgets list
```

Commit `docs/commands.md`. Help, schema, describe, docs, and completion should agree because they derive from the same catalogue.

## 12. Test at the right levels

A test earns its place by proving behaviour that can regress independently of the change: a contract, an invariant, a boundary, or a workflow. Do not add tests that mirror implementation data, restate a changed literal, or exist only because code was extracted. Deleting a test that no longer earns its signal is part of delivery.

Tests live in a `__tests__/` directory beside the code they prove and run on `bun:test`. When behaviour is worth protecting, choose the cheapest honest layer:

- unit tests for pure parsing, validation, filtering, or transformation logic;
- integration tests through real argv for exit codes, JSON envelopes, stdout/stderr discipline, `NO_COLOR` output, and headless write safety;
- one end-to-end path against a real server when the change spans client, service, and schema wiring; and
- a compiled-binary smoke test for release-sensitive changes.

Run:

```bash
bun run check
bun run ci
bun run build:release
```

`bun run check` applies the Ultracite policy through Oxlint and Oxfmt. Use `bun run fix` for safe mechanical rewrites, then review the resulting diff and rerun the complete gate. Type-aware Oxlint rules are enabled and complement the separate TypeScript compiler check.

The release build covers macOS and Linux on arm64 and x64. Test a real interactive flow manually when prompts or live terminal layout change.

## 13. Adapt the agent files

`AGENTS.md` governs repository changes. Add product-specific architectural rules there without duplicating implementation details.

`SKILL.md` teaches an agent how to operate the built CLI. Update its frontmatter, safe read paths, write confirmation rules, auth setup, examples, and recovery steps. Prefer `schema --json` and `describe` over copying the entire command catalogue into the skill.

## 14. Prepare a release

Before publishing:

1. finish the rename and metadata;
2. remove unused example code;
3. run the complete gate on macOS and Linux;
4. build release targets;
5. verify `--help`, `version`, `doctor`, `schema --json`, and completion;
6. test `NO_COLOR=1` and a headless write;
7. inspect the repository for secrets or private references; and
8. publish a private beta or prerelease before promoting the public stable version.
