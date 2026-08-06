import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const dist = path.resolve(root, "dist/release");
const targets = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-arm64",
  "bun-linux-x64-baseline",
] as const;
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

const builds = await Promise.all(
  targets.map(async (target) => {
    const outfile = path.resolve(
      dist,
      `cli-template-${target.replace("bun-", "")}`
    );
    const result = await Bun.build({
      bytecode: true,
      compile: {
        autoloadBunfig: false,
        autoloadDotenv: false,
        outfile,
        target,
      },
      define: {
        "process.env.CLI_TEMPLATE_COMMIT": JSON.stringify(commit),
      },
      entrypoints: [path.resolve(root, "src/index.ts")],
      minify: true,
      sourcemap: "linked",
    });
    return { outfile, result };
  })
);

for (const { outfile, result } of builds) {
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exitCode = 1;
    continue;
  }
  console.log(`built ${outfile}`);
}
