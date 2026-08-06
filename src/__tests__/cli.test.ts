import { describe, expect, test } from "bun:test";
import path from "node:path";

import { z } from "zod";

const root = path.resolve(import.meta.dir, "../..");
const tokenPlaceholder = ["$", "{", "CLI_TEMPLATE_TOKEN", "}"].join("");

const requireBunExecutable = (): string => {
  const executable = Bun.which("bun");
  if (executable === null) {
    throw new Error(
      "The Bun executable is required for CLI integration tests."
    );
  }
  return executable;
};

const bunExecutable = requireBunExecutable();

const catalogEnvelopeSchema = z.object({
  data: z.object({
    commands: z.array(z.object({ path: z.array(z.string()) })),
    schemaVersion: z.literal(1),
  }),
  ok: z.literal(true),
});

const actionErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    hint: z.string(),
  }),
});

const dryRunEnvelopeSchema = z.object({
  data: z.object({
    mode: z.string(),
    request: z.object({
      body: z.object({ name: z.string() }),
      path: z.string(),
    }),
  }),
});

const parseJson = (value: string): unknown => JSON.parse(value);

const runCli = async (
  args: readonly string[],
  envOverrides: Readonly<Record<string, string>> = {}
) => {
  const process = Bun.spawn([bunExecutable, "src/index.ts", ...args], {
    cwd: root,
    env: {
      ...globalThis.process.env,
      CI: "1",
      CLI_TEMPLATE_BASE_URL: "http://127.0.0.1:8787",
      CLI_TEMPLATE_TOKEN: "secret-must-not-leak",
      NO_COLOR: "1",
      ...envOverrides,
    },
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { exitCode, stderr, stdout };
};

describe("CLI integration", () => {
  test("renders concise root help without ANSI", async () => {
    const result = await runCli(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("cli-template");
    expect(result.stdout).toContain("api");
    expect(result.stdout).toContain("items");
    expect(result.stdout).not.toContain("\u001B[");
  });

  test("emits a machine-readable command catalogue", async () => {
    const result = await runCli(["schema", "--json"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const envelope = catalogEnvelopeSchema.parse(parseJson(result.stdout));
    expect(envelope.ok).toBe(true);
    expect(envelope.data.schemaVersion).toBe(1);
    expect(
      envelope.data.commands.some(
        (command) => command.path.join(" ") === "items create"
      )
    ).toBe(true);
  });

  test("lists and describes API operations", async () => {
    const list = await runCli(["api", "ls"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain("GET");
    expect(list.stdout).toContain("PATCH");
    expect(list.stdout).toContain("/items");

    const descriptionResult = await runCli([
      "api",
      "describe",
      "PATCH",
      "/items/example",
    ]);
    expect(descriptionResult.exitCode).toBe(0);
    expect(descriptionResult.stdout).toContain("updateItem");
  });

  test("generates curl without exposing the configured token", async () => {
    const result = await runCli([
      "api",
      "/items",
      "-X",
      "POST",
      "-F",
      "name=First item",
      "-H",
      "X-Api-Key: another-secret",
      "--generate",
      "curl",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(tokenPlaceholder);
    expect(result.stdout).not.toContain("secret-must-not-leak");
    expect(result.stdout).not.toContain("another-secret");
    expect(result.stdout).toContain("X-Api-Key: <redacted>");
  });

  test("infers POST when a raw API request includes a body", async () => {
    const result = await runCli([
      "api",
      "/items",
      "-F",
      "name=First item",
      "--generate",
      "curl",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("-X POST");
  });

  test("requires explicit confirmation for headless mutations", async () => {
    const result = await runCli(["items", "create", "First item", "--json"]);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    const error = actionErrorSchema.parse(parseJson(result.stderr));
    expect(error.error.code).toBe("action_required");
    expect(error.error.hint).toContain("--yes");
  });

  test("returns the same dry-run plan in JSON without using the network", async () => {
    const result = await runCli([
      "items",
      "create",
      "First item",
      "--dry-run",
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const envelope = dryRunEnvelopeSchema.parse(parseJson(result.stdout));
    expect(envelope.data.mode).toBe("plan");
    expect(envelope.data.request.path).toBe("/items");
    expect(envelope.data.request.body).toEqual({ name: "First item" });
  });
});

const createdEnvelopeSchema = z.object({
  data: z.object({
    item: z.object({ id: z.string(), name: z.string() }),
    mode: z.literal("applied"),
  }),
  ok: z.literal(true),
});

const listEnvelopeSchema = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string() })),
  ok: z.literal(true),
});

const startExampleServer = async (): Promise<{
  url: string;
  stop: () => void;
}> => {
  const serverProcess = Bun.spawn(
    [bunExecutable, "scripts/example-server.ts"],
    {
      cwd: root,
      env: { ...globalThis.process.env, CLI_TEMPLATE_EXAMPLE_PORT: "0" },
      stderr: "pipe",
      stdin: "ignore",
      stdout: "ignore",
    }
  );
  const decoder = new TextDecoder();
  let banner = "";
  for await (const chunk of serverProcess.stderr) {
    banner += decoder.decode(chunk, { stream: true });
    const url = /listening on (?<url>http:\/\/[^\s/]+)/u.exec(banner)?.groups
      ?.url;
    if (url !== undefined) {
      return {
        stop() {
          serverProcess.kill();
        },
        url,
      };
    }
  }
  serverProcess.kill();
  throw new Error(`The example server did not start: ${banner}`);
};

describe("end-to-end against the example server", () => {
  test("creates, lists, and deletes an item through real HTTP", async () => {
    const server = await startExampleServer();
    const env = { CLI_TEMPLATE_BASE_URL: server.url };
    try {
      const created = await runCli(
        ["items", "create", "E2E item", "--yes", "--json"],
        env
      );
      expect(created.exitCode).toBe(0);
      const createdEnvelope = createdEnvelopeSchema.parse(
        parseJson(created.stdout)
      );
      const { id } = createdEnvelope.data.item;
      expect(createdEnvelope.data.item.name).toBe("E2E item");

      const listed = await runCli(["items", "list", "--json"], env);
      expect(listed.exitCode).toBe(0);
      const listEnvelope = listEnvelopeSchema.parse(parseJson(listed.stdout));
      expect(
        listEnvelope.data.some(
          (item) => item.id === id && item.name === "E2E item"
        )
      ).toBe(true);

      const removed = await runCli(
        ["api", `/items/${id}`, "-X", "DELETE", "--json"],
        env
      );
      expect(removed.exitCode).toBe(0);

      const after = await runCli(["items", "list", "--json"], env);
      const afterEnvelope = listEnvelopeSchema.parse(parseJson(after.stdout));
      expect(afterEnvelope.data.some((item) => item.id === id)).toBe(false);
    } finally {
      server.stop();
    }
  });
});
