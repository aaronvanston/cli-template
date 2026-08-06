# Product

## Purpose

This repository is a reusable Bun and TypeScript scaffold for production-quality command-line tools. It supplies a compact engine for commands, modules, injected services, help, presentation, errors, interactivity, API plumbing, tests, and cross-platform packaging.

Success means a developer can rename the repository, replace the disposable example module, and ship a focused CLI without rebuilding common terminal infrastructure or maintaining parallel command registries.

## Users

The primary user is a TypeScript developer building a CLI for people, automation, and coding agents on macOS or Linux. Operators should be able to explore commands interactively, while scripts should receive stable structured output, deterministic exit codes, and no surprise prompts.

## Personality

Exact, calm, and helpful. The CLI is concise during successful work and specific when something fails. Colour supports hierarchy without turning routine output into decoration.

## Principles

1. **One declaration, every surface.** A descriptor drives parsing, help, examples, discovery, docs, and completion.
2. **Human by default, machine on purpose.** Human output can be warm and readable; JSON, JSONL, pipes, and non-interactive execution are strict interfaces.
3. **Progressive disclosure.** Root help starts the workflow, command help shows runnable examples, and `schema` or `describe` exposes the full contract.
4. **Small engine, clear modules.** Modules own features, services own infrastructure, and the engine owns lifecycle and presentation.
5. **Errors continue the workflow.** Expected failures carry stable codes and offer a concrete next action when one exists.
6. **Writes are explicit.** Interactive confirmation is convenient, while `--dry-run` and `--yes` provide deterministic headless routes.

## Accessibility

Colour never carries meaning alone. Status includes text or a stable symbol, and plain ASCII output remains useful. The CLI honours `NO_COLOR`, `TERM=dumb`, explicit colour flags, reduced terminal width, non-TTY streams, CI, and non-interactive execution. macOS and Linux on arm64 and x64 are first-class targets.

## Anti-patterns

- full-screen takeover as the default experience;
- decorative banners or animation that delay the task;
- handwritten dispatch switches and help strings that drift;
- framework ceremony for small feature modules;
- prompts in CI, pipes, JSON, or agent runs;
- prose-only failures that force callers to parse English; and
- credentials exposed in logs, errors, or generated commands.
