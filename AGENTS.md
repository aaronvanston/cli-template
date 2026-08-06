# CLI Template

This is a public Bun and TypeScript scaffold for small production CLIs. Read `PRODUCT.md`, `DESIGN.md`, `docs/architecture.md`, and `docs/extending.md` before changing the engine or presentation contract.

## How we work

These principles govern how changes are judged in this repository and in every CLI generated from it, in priority order.

### 1. Tests earn their place

No earned signal, no test. A test exists to prove behaviour that can regress independently of the edit that introduced it: a contract, an invariant, a boundary, or a workflow. It does not exist to mirror a diff, restate a literal, or make a change look safer.

- An existing test is evidence of a past decision, not authority over the next one. Before preserving behaviour because a test asserts it, decide whether the test protects a real contract. Deleting a test that no longer earns its signal is a normal, expected change.
- Do not add tests because code was extracted, because a static value changed, or to assert that a mock was called with exactly what the test passed in.
- Put each test at its cheapest honest layer: pure logic in unit tests, wiring and schemas in integration tests through the real harness, user journeys end to end.

### 2. Build toward the right model

The existing implementation is raw material, not a constraint — especially in agent-built code, where the current shape is often scaffolded history rather than intended design. Decide the right model first, then make the code conform.

- Prefer the change that deletes complexity over the one that rearranges it.
- Route ambition through the seams that already exist: deepen the owning module instead of inventing a parallel helper, wrapper, flag, or mode beside it.
- Ambition is not expansion. No speculative robustness, no compatibility nobody depends on, no abstraction with one caller, no exports created solely to be unit tested.
- Cleanup is part of delivery: replacing a model means removing its obsolete fields, tests, docs, and affordances in the same change.

### 3. Evidence over confidence

Typecheck, lint, and unit tests prove code correctness, not feature correctness. When a change touches runtime behaviour — a command, prompt, output mode, build script, or the example API — exercise the real surface before calling the work done: run the actual command, drive the actual prompt in a TTY, hit the actual server, and check the actual exit code and stderr. Report what was exercised and what was not.

## Hard rules

- A command is declared once with `defineCommand`; registration, help, schema, docs, and completions derive from that descriptor.
- Commands return typed outcomes. Only the engine writes to stdout or stderr.
- Structured data goes to stdout. Diagnostics and progress go to stderr.
- JSON, JSONL, CI, piped, and non-interactive execution never prompt or animate.
- Colour is semantic, never the only signal, and must honour `NO_COLOR`, `TERM=dumb`, and `--color`.
- Domain modules depend on service tokens, not concrete infrastructure.
- Tests are colocated: a `__tests__/` directory beside the code it proves, running on `bun:test`. No separate top-level test tree, no other runner.
- This template optimises for its owner on current Bun, macOS, and Linux. Do not add backwards-compatibility shims, deprecation cycles, legacy runtime support, or old/new dual code paths; change the model and move forward.
- API credentials are attached only to the configured base origin and are redacted from diagnostics.
- Keep the runtime dependency set small. A new dependency needs a concrete cross-cutting benefit.
- Keep committed examples, docs, fixtures, screenshots, and history public-safe. Never add real credentials, customer data, internal URLs, or private project context.
- `src/modules/items/` and `scripts/example-server.ts` are disposable teaching examples, not product-domain foundations.
- Ultracite is the quality-policy source. Oxlint and Oxfmt are the underlying Oxc tools; keep their committed configs aligned with the Ultracite presets.

## Quality gate

Run:

```bash
bun run ci
```

Use `bun run check` for the standalone Ultracite check and `bun run fix` for safe automatic rewrites. Review formatter or linter changes before committing.

Generated command documentation must be committed.

For prompt or presentation changes, also exercise `bun run dev -- api` in a real TTY and verify `NO_COLOR=1 bun run dev -- api ls`.
