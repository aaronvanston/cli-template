# CLI Template

An opinionated Bun and TypeScript starting point for command-line products that feel good in a terminal and remain predictable in scripts, CI, and coding agents.

The template includes:

- descriptor-driven commands, help, examples, docs, and shell completions;
- Vercel-inspired visual hierarchy and searchable API discovery;
- distinct GET, POST, PUT, PATCH, and DELETE colours with plain-text fallbacks;
- human, JSON, and JSONL output contracts;
- line-oriented prompts that automatically disappear in headless execution;
- lazy typed services for API clients, configuration, or other infrastructure;
- explicit mutation safety with `--dry-run` and `--yes`;
- an in-memory example API and a disposable `items` module;
- standalone macOS and Linux builds; and
- tests, linting, type checking, generated docs, and GitHub Actions CI.

The engine is intentionally small. It provides the reusable CLI mechanics while feature modules own product behaviour.

## Try it in two minutes

Install the dependencies:

```bash
bun install
```

Start the included in-memory API in one terminal:

```bash
bun run example:server
```

In another terminal, exercise the CLI:

```bash
bun run dev -- --help
bun run dev -- items list
bun run dev -- items create "Try the template" --dry-run
bun run dev -- items create "Try the template" --yes
bun run dev -- items list --json
```

The server listens on `http://127.0.0.1:8787` and keeps data in memory. Stopping it resets the example state.

### Try the interactive API mode

Run the `api` command without a path in a real terminal:

```bash
bun run dev -- api
```

Type to search by HTTP method, route, operation name, description, or tag. Use the arrow keys to move, Enter to select, and Ctrl-C to cancel. The bundled manifest deliberately includes every supported method so the method palette is easy to inspect:

- GET is cyan;
- POST is green;
- PUT is yellow;
- PATCH is blue; and
- DELETE is red.

Colour improves scanning but never carries meaning by itself. Verify the plain mode at any time:

```bash
NO_COLOR=1 bun run dev -- api ls
bun run dev -- api ls --color never
```

The interactive picker is an optional convenience. Every operation still has a complete, prompt-free route:

```bash
bun run dev -- api /health
bun run dev -- api /items
bun run dev -- api /items -X POST -F name="From the API command"
bun run dev -- api /items/item-1 -X PATCH -F status=archived
bun run dev -- api /items/item-1 -X DELETE
```

Direct raw API calls do exactly what their flags request. The interactive picker asks before sending a selected mutation, while higher-level write commands use `--dry-run` and `--yes`.

## Create a CLI from the template

Start in a fresh clone or use GitHub's **Use this template** action, then preview the controlled rename:

```bash
bun install
bun run rename acme-tools
```

The dry run lists every file containing a template token. Apply it only after reviewing the list:

```bash
bun run rename acme-tools --apply
bun install
bun run ci
```

The rename updates:

- `cli-template` to the package and binary name;
- `CLI Template` to the display name;
- `CLI_TEMPLATE` to the environment-variable prefix; and
- `CliTemplate` to the PascalCase identifier.

After renaming, update the description, homepage, repository metadata, license holder, and `SKILL.md` wording for the real product. Then delete `scripts/rename.ts`, its `__tests__` directory, and the `rename` entry in `package.json`; the rename is one-shot and those files deliberately keep template tokens.

`package.json` starts with `"private": true` to prevent accidental npm publication. Remove or change that guard only when package-registry publishing is an intentional release channel.

## Repository map

```text
src/
  app.ts                 CLI metadata and statically attached modules
  index.ts               Process entry point
  __tests__/             whole-CLI integration and end-to-end tests
  engine/                Parser binding, lifecycle, output, style, services
  modules/
    system/              version, doctor, schema, describe, completion
    api/                 fixed-origin client, route manifest, raw API command
    items/               disposable example of polished resource commands
scripts/
  example-server.ts      local in-memory API for manual testing
  generate-docs.ts       descriptor-to-Markdown generator
  rename.ts              controlled template token replacement
  build.ts               current-platform standalone executable
  build-release.ts       macOS and Linux release executables
docs/
  architecture.md        ownership boundaries and runtime lifecycle
  extending.md           step-by-step extension guide
  commands.md            generated command reference
AGENTS.md                coding constraints for repository agents
CLAUDE.md                symlink to AGENTS.md for Claude Code
SKILL.md                 example operating skill for CLI-aware agents
oxlint.config.ts         Ultracite rules on the Oxc linter
oxfmt.config.ts          Ultracite formatting on the Oxc formatter
```

## The command model

A command is declared once:

```ts
export const widgetsListCommand = defineCommand({
  path: ["widgets", "list"],
  module: "widgets",
  summary: "List widgets",
  options: [
    {
      flags: "--limit <count>",
      description: "Maximum number of widgets",
      defaultValue: 20,
    },
  ],
  examples: ["cli-template widgets list", "cli-template widgets list --json"],
  optionsSchema: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
  outputSchema: z.array(widgetSchema),
  async run(context) {
    const service = await context.services.get(widgetsService);
    return { data: await service.list(context.options.limit) };
  },
  render(data, context) {
    return context.ui.table(
      ["ID", "Name"],
      data.map((widget) => [widget.id, widget.name])
    );
  },
});
```

That descriptor drives:

- Commander registration;
- nested help and examples;
- the machine-readable `schema` catalogue;
- `describe`;
- generated Markdown; and
- static shell completion.

Feature code does not import Commander and does not print directly. Handlers return typed outcomes; the engine owns stdout, stderr, errors, and presentation.

## Add, replace, or remove a feature

The `items` module exists to show a complete read/write pattern. It is test data and never a domain assumption.

For a small CLI, rename `src/modules/items/` and edit its descriptors. For a different product shape:

1. create `src/modules/<feature>/commands.ts`;
2. export a module from `src/modules/<feature>/module.ts`;
3. attach the module in `src/app.ts`;
4. add or reuse typed services;
5. update tests;
6. run `bun run docs`; and
7. run `bun run ci`.

Delete `src/modules/items/` and remove its import from `src/app.ts` once the first real module exists. Delete `scripts/example-server.ts` and the `example:server` script if the product does not need an API.

The detailed version of this workflow is in [`docs/extending.md`](docs/extending.md).

## API plumbing

The API module is both a reusable client boundary and an advanced escape hatch. It supports:

- a fixed configured origin;
- bearer-token attachment only to that origin;
- repeated headers;
- typed `-F key=value` and string `-f key=value` fields;
- JSON bodies from a file or stdin;
- optional response headers;
- silent status-only execution;
- safe curl generation with credentials redacted;
- searchable route discovery; and
- interactive path-parameter entry and mutation confirmation.

Configure it with:

```bash
export CLI_TEMPLATE_BASE_URL=https://api.example.com
export CLI_TEMPLATE_TOKEN=replace-me
```

A local `.env` file also works during development: Bun loads it automatically and git ignores it. Compiled releases deliberately do not auto-load `.env`, so release configuration stays explicit.

The defaults target the bundled example server. The token is never embedded in generated curl output or diagnostics.

Edit `src/modules/api/endpoints.ts` to replace the example manifest. A generated OpenAPI loader can later supply the same `ApiEndpoint[]` shape without changing the picker or raw request command.

If the product has no HTTP surface, remove both the `api` and `items` modules from `src/app.ts`, then delete their directories and related checks.

## Output and automation contract

- Human output is the default.
- `--json` emits one versioned result or error envelope.
- `--jsonl` emits versioned event records and is the extension point for streams.
- Structured results go to stdout.
- diagnostics, progress, warnings, and prompts go to stderr.
- `--non-interactive`, `--no-input`, CI, machine modes, or non-TTY input disable prompts.
- `--color auto|always|never`, `--no-color`, `NO_COLOR`, and `TERM=dumb` are honoured.
- Expected failures carry a stable code, exit status, message, and optional recovery hint.
- A write command must have an explicit headless route such as `--yes`, and should provide `--dry-run` when a meaningful plan exists.

Useful discovery commands for people and agents:

```bash
cli-template --help
cli-template items --help
cli-template describe items create
cli-template schema --json
cli-template api ls --json
cli-template completion zsh
```

## Agent use

`SKILL.md` is an example operating guide for a coding agent that needs to call or extend the generated CLI. It teaches the agent to discover commands, prefer JSON, avoid prompts, preview writes, and validate repository changes.

After renaming:

1. update its frontmatter name and description;
2. replace the example commands and environment variables;
3. document real authentication and configuration;
4. list safe read commands and guarded write commands;
5. add product-specific recovery guidance; and
6. keep the file beside the CLI source or install it in the agent system used by the project.

`AGENTS.md` serves a different purpose: it constrains agents editing the repository. Keep both when the CLI will be operated and maintained by agents.

## Test and verify

Run the complete local gate:

```bash
bun run ci
```

It regenerates `docs/commands.md`, lints, type-checks, runs tests, and compiles a standalone executable for the current machine.

Individual commands are available while iterating:

```bash
bun run docs
bun run check
bun run fix
bun run lint
bun run typecheck
bun test
bun run build
```

`check` and `lint` both run Ultracite across the repository. For this template, Ultracite uses Oxlint for linting and Oxfmt for formatting, with Oxlint's type-aware rules enabled through `oxlint-tsgolint`. `fix` applies the safe formatter and linter rewrites; review its diff before committing.

Smoke-test the compiled binary:

```bash
./dist/cli-template --version
./dist/cli-template schema --json
```

GitHub Actions runs the same gate on macOS and Linux. The checked-in generated command reference must remain in sync.

## Build releases

Build the current platform:

```bash
bun run build
```

Cross-compile release executables:

```bash
bun run build:release
```

The release script targets:

- macOS arm64;
- macOS x64;
- Linux arm64; and
- Linux x64 baseline for compatibility with older CPUs.

Compiled executables disable Bun's implicit `.env` and `bunfig.toml` loading so release configuration stays explicit.

## Dependencies

- [Bun](https://bun.sh/) runs, tests, and compiles the TypeScript source.
- [Commander](https://github.com/tj/commander.js) supplies mature parsing behind the descriptor binder.
- [Zod](https://zod.dev/) validates options, inputs, outputs, and API boundaries.
- [picocolors](https://github.com/alexeyraspopov/picocolors) provides semantic terminal colour.
- [Clack](https://github.com/bombshell-dev/clack) supplies lazily loaded text, confirmation, and autocomplete search prompts.
- [Ultracite](https://www.ultracite.ai/) supplies the shared quality preset.
- [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) and [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) provide the Oxc-powered linter and formatter.

The dependency set stays deliberately small. Add a runtime package only when it solves a cross-cutting problem that the engine should own.

## Intentional non-goals

The baseline does not include:

- a full-screen TUI;
- runtime third-party plugins;
- implicit telemetry;
- automatic shell-profile edits;
- an automatic self-updater;
- a configuration or credential store before a product needs one; or
- daemon, scheduler, MCP, or JSON-RPC lifecycles in the core engine.

Those can be modules or lifecycle adapters once a real consumer proves the required boundary.

## License

MIT. See [`LICENSE`](LICENSE).
