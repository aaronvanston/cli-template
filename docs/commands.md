# cli-template command reference

Generated from command descriptors for cli-template 0.1.0.

A Bun and TypeScript CLI scaffold for humans, scripts, and agents

## `cli-template api [endpoint]`

Make an authenticated request to the configured API

Uses the same fixed-origin client as porcelain commands. Run without a path for line-oriented endpoint selection in a TTY. Catalogued as a write because it sends whichever method the flags request; plain GET reads are safe and need no confirmation.

### Options

- `-X, --method <method>` — HTTP method; defaults to the selected operation, POST with a body, or GET.
- `-H, --header <header>` — Request header as 'name: value' (repeatable). Default: `[]`.
- `-F, --field <key=value>` — Typed JSON body field (repeatable). Default: `[]`.
- `-f, --raw-field <key=value>` — String body field (repeatable). Default: `[]`.
- `--input <path>` — Read a JSON object from a file or '-' for stdin.
- `-i, --include` — Include response status and headers.
- `--silent` — Emit no response body; use exit status only.
- `--timeout <milliseconds>` — Request timeout. Default: `30000`.
- `--generate <format>` — Generate a safe request instead of sending it.

### Examples

```bash
cli-template api /health
cli-template api /items -X POST -F name="First item"
cli-template api /items -X POST --input item.json
cli-template api /items -X POST -F name="First item" --generate curl
```

## `cli-template api describe <method> <path>`

Describe one known API operation

### Examples

```bash
cli-template api describe GET /items
cli-template api describe PATCH /items/example --json
```

## `cli-template api list`

List known API operations

### Options

- `--filter <query>` — Filter by method, path, tag, or summary. Default: `""`.

### Examples

```bash
cli-template api ls
cli-template api ls --filter items --json
```

## `cli-template completion <shell>`

Generate a shell completion script

### Examples

```bash
cli-template completion zsh > ~/.zfunc/_cli-template
cli-template completion fish > ~/.config/fish/completions/cli-template.fish
```

## `cli-template describe <command...>`

Describe one command and its contract

### Examples

```bash
cli-template describe items create
cli-template describe api --json
```

## `cli-template doctor`

Check the local install and configuration

Runs fast, offline checks. It does not contact the configured service.

### Examples

```bash
cli-template doctor
cli-template doctor --json
```

## `cli-template items create <name>`

Create an example item with explicit mutation safety

### Options

- `--dry-run` — Print the request plan without sending it.
- `-y, --yes` — Confirm the mutation without prompting.

### Examples

```bash
cli-template items create "First item" --dry-run
cli-template items create "First item" --yes --json
```

## `cli-template items list`

List example items through the shared API service

### Options

- `--limit <count>` — Maximum number of items. Default: `20`.

### Examples

```bash
cli-template items list
cli-template items list --limit 5 --json
```

## `cli-template schema`

Print the machine-readable command catalogue

### Examples

```bash
cli-template schema --json
```

## `cli-template version`

Show detailed version and runtime information

### Examples

```bash
cli-template version
cli-template version --json
```
