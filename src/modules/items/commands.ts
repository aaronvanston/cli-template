import { z } from "zod";

import { AppError, defineCommand, ExitCode } from "../../engine/index.ts";
import { apiClient } from "../api/client.ts";

const itemSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  status: z.string().default("active"),
});

const itemsListOptions = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const itemsListCommand = defineCommand({
  aliases: ["ls"],
  examples: [
    "cli-template items list",
    "cli-template items list --limit 5 --json",
  ],
  module: "items",
  options: [
    {
      defaultValue: 20,
      description: "Maximum number of items",
      flags: "--limit <count>",
    },
  ],
  optionsSchema: itemsListOptions,
  outputSchema: z.array(itemSchema),
  path: ["items", "list"],
  render(data, context) {
    if (data.length === 0) {
      return [
        context.ui.muted("No example items found."),
        `Create one with ${context.ui.command(
          `${context.app.meta.name} items create "First item"`
        )}.`,
      ].join("\n");
    }
    return context.ui.table(
      ["ID", "Name", "Status"],
      data.map((item) => [item.id, item.name, item.status])
    );
  },
  async run(context) {
    const client = await context.services.get(apiClient);
    const response = await client.request({
      method: "GET",
      path: `/items?limit=${context.options.limit}`,
      signal: context.signal,
      timeoutMs: 30_000,
    });
    const { body } = response;
    let candidates: unknown = body;
    if (
      !Array.isArray(body) &&
      body !== null &&
      typeof body === "object" &&
      "items" in body
    ) {
      candidates = body.items;
    }
    const parsed = z.array(itemSchema).safeParse(candidates);
    if (!parsed.success) {
      throw new AppError({
        code: "invalid_items_response",
        details: parsed.error.issues,
        message: "The API response did not contain a valid items array.",
      });
    }
    return { data: parsed.data };
  },
  summary: "List example items through the shared API service",
});

const itemsCreateOptions = z.object({
  dryRun: z.boolean().default(false),
  yes: z.boolean().default(false),
});

const itemsCreateOutput = z.union([
  z.object({
    mode: z.literal("plan"),
    request: z.object({
      body: z.object({ name: z.string() }),
      method: z.literal("POST"),
      path: z.literal("/items"),
    }),
  }),
  z.object({
    item: itemSchema,
    mode: z.literal("applied"),
  }),
]);

const confirmCreate = async (
  name: string,
  signal: AbortSignal
): Promise<boolean> => {
  const { confirm, isCancel } = await import("@clack/prompts");
  const answer = await confirm({
    initialValue: false,
    input: process.stdin,
    message: `Create the example item "${name}"?`,
    output: process.stderr,
    signal,
  });
  if (isCancel(answer)) {
    return false;
  }
  return answer;
};

export const itemsCreateCommand = defineCommand({
  arguments: [
    {
      description: "Name for the example item",
      name: "name",
      required: true,
    },
  ],
  examples: [
    'cli-template items create "First item" --dry-run',
    'cli-template items create "First item" --yes --json',
  ],
  kind: "write",
  module: "items",
  options: [
    {
      description: "Print the request plan without sending it",
      flags: "--dry-run",
    },
    {
      description: "Confirm the mutation without prompting",
      flags: "-y, --yes",
    },
  ],
  optionsSchema: itemsCreateOptions,
  outputSchema: itemsCreateOutput,
  path: ["items", "create"],
  render(data, context) {
    if (data.mode === "plan") {
      return [
        `${context.ui.info(context.ui.symbols.pending)} ${context.ui.heading(
          "Dry run"
        )}`,
        `${context.ui.muted("method")}  ${data.request.method}`,
        `${context.ui.muted("path")}    ${data.request.path}`,
        `${context.ui.muted("body")}    ${JSON.stringify(data.request.body)}`,
      ].join("\n");
    }
    return `${context.ui.success(context.ui.symbols.success)} Created ${context.ui.command(
      data.item.id
    )} ${data.item.name}`;
  },
  async run(context) {
    const name = String(context.arguments.name).trim();
    if (name.length === 0) {
      throw new AppError({
        code: "item_name_required",
        exitCode: ExitCode.USAGE,
        message: "The item name cannot be empty.",
      });
    }
    const request = {
      body: { name },
      method: "POST" as const,
      path: "/items" as const,
    };
    if (context.options.dryRun) {
      return {
        data: {
          mode: "plan" as const,
          request,
        },
        hint: `Apply with '${context.app.meta.name} items create ${JSON.stringify(
          name
        )} --yes'.`,
      };
    }

    const confirmed =
      context.options.yes ||
      (context.interactive ? await confirmCreate(name, context.signal) : false);
    if (!confirmed) {
      throw new AppError({
        code: context.interactive ? "action_cancelled" : "action_required",
        exitCode: context.interactive ? ExitCode.ERROR : ExitCode.USAGE,
        hint: "Preview with '--dry-run' or apply with '--yes'.",
        message: context.interactive
          ? "The example item was not created."
          : "This command needs explicit confirmation in non-interactive mode.",
      });
    }

    const client = await context.services.get(apiClient);
    const response = await client.request({
      ...request,
      signal: context.signal,
      timeoutMs: 30_000,
    });
    const parsed = itemSchema.safeParse(response.body);
    if (!parsed.success) {
      throw new AppError({
        code: "invalid_item_response",
        details: parsed.error.issues,
        message: "The API response did not contain a valid item.",
      });
    }
    return {
      data: {
        item: parsed.data,
        mode: "applied" as const,
      },
    };
  },
  summary: "Create an example item with explicit mutation safety",
});
