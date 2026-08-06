import { readdir } from "node:fs/promises";
import path from "node:path";

const ignoredDirectories = new Set([".git", "dist", "node_modules"]);
const editableNames = new Set([
  ".gitignore",
  "AGENTS.md",
  "DESIGN.md",
  "PRODUCT.md",
  "README.md",
  "bun.lock",
  "package.json",
  "tsconfig.json",
]);
const editableExtensions = new Set([
  ".json",
  ".lock",
  ".md",
  ".ts",
  ".yaml",
  ".yml",
]);

const extension = (filePath: string): string => {
  const match = /(?<extension>\.[^./]+)$/u.exec(filePath);
  return match?.groups?.extension ?? "";
};

export const titleCase = (name: string): string =>
  name
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");

export const environmentPrefix = (name: string): string =>
  name.replaceAll("-", "_").toUpperCase();

export const replaceTemplateTokens = (
  contents: string,
  name: string
): string => {
  const title = titleCase(name);
  const pascal = title.replaceAll(" ", "");
  return contents
    .replaceAll("CLI_TEMPLATE", environmentPrefix(name))
    .replaceAll("CliTemplate", pascal)
    .replaceAll("CLI Template", title)
    .replaceAll("cli-template", name);
};

const editableFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
        return [];
      }
      const filePath = path.resolve(directory, entry.name);
      if (entry.isDirectory()) {
        return await editableFiles(filePath);
      }
      const editable =
        entry.isFile() &&
        (editableNames.has(entry.name) ||
          editableExtensions.has(extension(filePath)));
      return editable ? [filePath] : [];
    })
  );
  return files.flat();
};

const main = async (): Promise<void> => {
  const [name, ...flags] = process.argv.slice(2);
  if (
    name === undefined ||
    name === "" ||
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(name)
  ) {
    console.error(
      "usage: bun run rename <kebab-case-name> [--apply]\nexample: bun run rename acme-tools --apply"
    );
    process.exitCode = 2;
    return;
  }
  const apply = flags.includes("--apply");
  const root = path.resolve(import.meta.dir, "..");
  const files = await editableFiles(root);
  const candidates = await Promise.all(
    files.map(async (filePath) => {
      const contents = await Bun.file(filePath).text();
      const next = replaceTemplateTokens(contents, name);
      return next === contents ? undefined : { contents: next, path: filePath };
    })
  );
  const changes = candidates.filter(
    (change): change is { path: string; contents: string } =>
      change !== undefined
  );

  for (const change of changes) {
    console.log(change.path.slice(root.length + 1));
  }
  if (apply) {
    await Promise.all(
      changes.map(async (change) => {
        await Bun.write(change.path, change.contents);
      })
    );
  }
  if (changes.length === 0) {
    console.log("No template tokens found.");
    return;
  }
  if (apply) {
    console.log(
      `\nRenamed ${changes.length} files for ${name}. Run 'bun install && bun run ci'.`
    );
  } else {
    console.log(
      `\nDry run: ${changes.length} files would change. Re-run with --apply.`
    );
  }
};

if (import.meta.main) {
  void main();
}
