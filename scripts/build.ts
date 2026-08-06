import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const dist = path.resolve(root, "dist");
const outfile = path.resolve(dist, "cli-template");
const commitProcess = Bun.spawnSync({
  cmd: ["git", "rev-parse", "--short=12", "HEAD"],
  cwd: root,
  stderr: "ignore",
  stdout: "pipe",
});
const commit =
  commitProcess.exitCode === 0
    ? commitProcess.stdout.toString().trim()
    : "unknown";

await rm(dist, { force: true, recursive: true });
await mkdir(dist, { recursive: true });

const result = await Bun.build({
  bytecode: true,
  compile: {
    autoloadBunfig: false,
    autoloadDotenv: false,
    outfile,
  },
  define: {
    "process.env.CLI_TEMPLATE_COMMIT": JSON.stringify(commit),
  },
  entrypoints: [path.resolve(root, "src/index.ts")],
  minify: true,
  sourcemap: "linked",
});

if (result.success) {
  console.log(`built ${outfile}`);
} else {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exitCode = 1;
}
