import { z } from "zod";

import { AppError, defineCommand, ExitCode } from "../../engine/index.ts";
import type { Ui } from "../../engine/index.ts";
import { apiClient } from "./client.ts";
import { apiEndpoints, findEndpoint } from "./endpoints.ts";
import { curlCommand, parseFields, parseHeaders, readInput } from "./fields.ts";
import { filterEndpoints, searchEndpoints } from "./search.ts";
import { httpMethodSchema } from "./types.ts";
import type { ApiEndpoint, HttpMethod } from "./types.ts";

const apiOptionsSchema = z.object({
  field: z.array(z.string()).default([]),
  generate: z.enum(["curl"]).optional(),
  header: z.array(z.string()).default([]),
  include: z.boolean().default(false),
  input: z.string().optional(),
  method: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(httpMethodSchema)
    .optional(),
  rawField: z.array(z.string()).default([]),
  silent: z.boolean().default(false),
  timeout: z.coerce.number().int().min(1).max(300_000).default(30_000),
});

const apiResponseSchema = z.union([
  z.object({
    body: z.unknown(),
    headers: z.record(z.string(), z.string()).optional(),
    status: z.number(),
    statusText: z.string(),
  }),
  z.object({ command: z.string() }),
]);

const resolvePathParameters = async (
  endpoint: ApiEndpoint,
  signal: AbortSignal
): Promise<string | undefined> => {
  const names = [...endpoint.path.matchAll(/\{(?<name>[^}/]+)\}/gu)].flatMap(
    (match) => {
      const name = match.groups?.name;
      return name === undefined ? [] : [name];
    }
  );
  if (names.length === 0) {
    return endpoint.path;
  }

  const { isCancel, text } = await import("@clack/prompts");
  let { path } = endpoint;
  for (const name of new Set(names)) {
    // Path parameters are intentionally collected in route order.
    // oxlint-disable-next-line no-await-in-loop -- parallel prompts would overlap on one terminal.
    const value = await text({
      input: process.stdin,
      message: `Value for {${name}}`,
      output: process.stderr,
      placeholder: name,
      signal,
      validate(input) {
        return input !== undefined && input.trim() !== ""
          ? undefined
          : `${name} is required`;
      },
    });
    if (isCancel(value)) {
      return undefined;
    }
    path = path.replaceAll(`{${name}}`, encodeURIComponent(value));
  }
  return path;
};

const confirmInteractiveMutation = async (
  method: HttpMethod,
  path: string,
  signal: AbortSignal
): Promise<boolean> => {
  const { confirm, isCancel } = await import("@clack/prompts");
  const answer = await confirm({
    initialValue: false,
    input: process.stdin,
    message: `Send ${method} ${path}?`,
    output: process.stderr,
    signal,
  });
  if (isCancel(answer)) {
    return false;
  }
  return answer;
};

const resolveApiTarget = async (input: {
  appName: string;
  endpointArgument: unknown;
  interactive: boolean;
  signal: AbortSignal;
  ui: Ui;
}): Promise<{ path: string; selectedEndpoint?: ApiEndpoint }> => {
  const { appName, endpointArgument, interactive, signal, ui } = input;
  if (typeof endpointArgument === "string" && endpointArgument !== "") {
    return { path: endpointArgument };
  }
  if (!interactive) {
    throw new AppError({
      code: "endpoint_required",
      exitCode: ExitCode.USAGE,
      hint: `Run '${appName} api ls' or pass a path such as '/health'.`,
      message: "An API endpoint path is required.",
    });
  }

  const selectedEndpoint = await searchEndpoints({
    endpoints: apiEndpoints,
    signal,
    ui,
  });
  if (selectedEndpoint === undefined) {
    throw new AppError({
      code: "action_cancelled",
      exitCode: ExitCode.ERROR,
      message: "Endpoint selection was cancelled.",
    });
  }
  const path = await resolvePathParameters(selectedEndpoint, signal);
  if (path === undefined) {
    throw new AppError({
      code: "action_cancelled",
      exitCode: ExitCode.ERROR,
      message: "Endpoint selection was cancelled.",
    });
  }
  return { path, selectedEndpoint };
};

export const apiCommand = defineCommand({
  arguments: [
    {
      description: "Root-relative API path",
      name: "endpoint",
      required: false,
    },
  ],
  description:
    "Uses the same fixed-origin client as porcelain commands. Run without a path for line-oriented endpoint selection in a TTY. Catalogued as a write because it sends whichever method the flags request; plain GET reads are safe and need no confirmation.",
  examples: [
    "cli-template api /health",
    'cli-template api /items -X POST -F name="First item"',
    "cli-template api /items -X POST --input item.json",
    'cli-template api /items -X POST -F name="First item" --generate curl',
  ],
  kind: "write",
  module: "api",
  options: [
    {
      choices: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      description:
        "HTTP method; defaults to the selected operation, POST with a body, or GET",
      flags: "-X, --method <method>",
    },
    {
      collect: true,
      defaultValue: [],
      description: "Request header as 'name: value' (repeatable)",
      flags: "-H, --header <header>",
    },
    {
      collect: true,
      defaultValue: [],
      description: "Typed JSON body field (repeatable)",
      flags: "-F, --field <key=value>",
    },
    {
      collect: true,
      defaultValue: [],
      description: "String body field (repeatable)",
      flags: "-f, --raw-field <key=value>",
    },
    {
      description: "Read a JSON object from a file or '-' for stdin",
      flags: "--input <path>",
    },
    {
      description: "Include response status and headers",
      flags: "-i, --include",
    },
    {
      description: "Emit no response body; use exit status only",
      flags: "--silent",
    },
    {
      defaultValue: 30_000,
      description: "Request timeout",
      flags: "--timeout <milliseconds>",
    },
    {
      choices: ["curl"],
      description: "Generate a safe request instead of sending it",
      flags: "--generate <format>",
    },
  ],
  optionsSchema: apiOptionsSchema,
  outputSchema: apiResponseSchema,
  path: ["api"],
  render(data, context) {
    if ("command" in data) {
      return data.command;
    }
    const lines: string[] = [];
    if (data.headers !== undefined) {
      lines.push(
        `${context.ui.success(context.ui.symbols.success)} ${data.status} ${data.statusText}`,
        ...Object.entries(data.headers).map(
          ([name, value]) => `${context.ui.muted(name)}: ${value}`
        ),
        ""
      );
    }
    lines.push(
      typeof data.body === "string"
        ? data.body
        : JSON.stringify(data.body, null, 2)
    );
    return lines.join("\n");
  },
  async run(context) {
    const { path, selectedEndpoint } = await resolveApiTarget({
      appName: context.app.meta.name,
      endpointArgument: context.arguments.endpoint,
      interactive: context.interactive,
      signal: context.signal,
      ui: context.ui,
    });

    const client = await context.services.get(apiClient);
    const headers = parseHeaders(context.options.header);
    const input = await readInput(context.options.input, context.cwd);
    const fields = parseFields(context.options.field, context.options.rawField);
    const body =
      Object.keys(input).length > 0 || Object.keys(fields).length > 0
        ? { ...input, ...fields }
        : undefined;
    const method =
      context.options.method ??
      selectedEndpoint?.method ??
      (body === undefined ? "GET" : "POST");

    if (context.options.generate === "curl") {
      return {
        data: {
          command: curlCommand({
            baseUrl: client.baseUrl,
            headers,
            method,
            path,
            ...(body === undefined ? {} : { body }),
          }),
        },
      };
    }

    if (
      selectedEndpoint?.mutates === true &&
      !(await confirmInteractiveMutation(method, path, context.signal))
    ) {
      throw new AppError({
        code: "action_cancelled",
        exitCode: ExitCode.ERROR,
        message: "The API request was not sent.",
      });
    }

    const response = await client.request({
      headers,
      method,
      path,
      signal: context.signal,
      timeoutMs: context.options.timeout,
      ...(body === undefined ? {} : { body }),
    });
    return {
      data: {
        body: response.body,
        ...(context.options.include ? { headers: response.headers } : {}),
        status: response.status,
        statusText: response.statusText,
      },
      silent: context.options.silent,
    };
  },
  summary: "Make an authenticated request to the configured API",
});

const apiListOptionsSchema = z.object({
  filter: z.string().default(""),
});

const endpointSchema = z.object({
  description: z.string(),
  method: httpMethodSchema,
  mutates: z.boolean(),
  operationId: z.string(),
  path: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
});

export const apiListCommand = defineCommand({
  aliases: ["ls"],
  examples: [
    "cli-template api ls",
    "cli-template api ls --filter items --json",
  ],
  module: "api",
  options: [
    {
      defaultValue: "",
      description: "Filter by method, path, tag, or summary",
      flags: "--filter <query>",
    },
  ],
  optionsSchema: apiListOptionsSchema,
  outputSchema: z.array(endpointSchema),
  path: ["api", "list"],
  render(data, context) {
    return context.ui.table(
      ["Method", "Path", "Summary"],
      data.map((endpoint) => [
        context.ui.httpMethod(endpoint.method),
        endpoint.path,
        context.ui.muted(endpoint.summary),
      ])
    );
  },
  run(context) {
    const endpoints = filterEndpoints(apiEndpoints, context.options.filter);
    return {
      data: endpoints.map((endpoint) => ({
        ...endpoint,
        tags: [...endpoint.tags],
      })),
    };
  },
  summary: "List known API operations",
});

export const apiDescribeCommand = defineCommand({
  arguments: [
    { description: "HTTP method", name: "method", required: true },
    { description: "Endpoint path", name: "path", required: true },
  ],
  examples: [
    "cli-template api describe GET /items",
    "cli-template api describe PATCH /items/example --json",
  ],
  module: "api",
  optionsSchema: z.object({}),
  outputSchema: endpointSchema,
  path: ["api", "describe"],
  render(data, context) {
    return [
      `${context.ui.httpMethod(data.method)} ${context.ui.heading(data.path)}`,
      data.summary,
      "",
      data.description,
      "",
      `${context.ui.muted("operation")}  ${data.operationId}`,
      `${context.ui.muted("tags")}       ${data.tags.join(", ")}`,
      `${context.ui.muted("mutates")}    ${data.mutates ? "yes" : "no"}`,
    ].join("\n");
  },
  run(context) {
    const methodValue = String(context.arguments.method).toUpperCase();
    const parsed = httpMethodSchema.safeParse(methodValue);
    if (!parsed.success) {
      throw new AppError({
        code: "invalid_method",
        exitCode: ExitCode.USAGE,
        hint: `Choose one of: ${httpMethodSchema.options.join(", ")}.`,
        message: `Unsupported HTTP method "${methodValue}".`,
      });
    }
    const path = String(context.arguments.path);
    const endpoint = findEndpoint(parsed.data, path);
    if (endpoint === undefined) {
      throw new AppError({
        code: "endpoint_not_found",
        exitCode: ExitCode.USAGE,
        hint: `Run '${context.app.meta.name} api ls --filter ${path}'.`,
        message: `No endpoint matches ${parsed.data} ${path}.`,
      });
    }
    return { data: { ...endpoint, tags: [...endpoint.tags] } };
  },
  summary: "Describe one known API operation",
});
