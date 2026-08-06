import { readFile } from "node:fs/promises";
import path from "node:path";

import { AppError, ExitCode } from "../../engine/index.ts";
import { safeUrl } from "./client.ts";

const entry = (value: string): [string, string] => {
  const separator = value.indexOf("=");
  if (separator <= 0) {
    throw new AppError({
      code: "invalid_field",
      exitCode: ExitCode.USAGE,
      message: `Expected key=value, received "${value}".`,
    });
  }
  return [value.slice(0, separator), value.slice(separator + 1)];
};

const typed = (value: string): unknown => {
  const normalized = value.trim();
  if (normalized === "") {
    return "";
  }
  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    return value;
  }
};

export const parseFields = (
  values: readonly string[],
  rawValues: readonly string[]
): Record<string, unknown> =>
  Object.fromEntries([
    ...values.map((value) => {
      const [key, raw] = entry(value);
      return [key, typed(raw)] as const;
    }),
    ...rawValues.map((value) => entry(value)),
  ]);

export const parseHeaders = (
  values: readonly string[]
): Record<string, string> =>
  Object.fromEntries(
    values.map((value) => {
      const separator = value.indexOf(":");
      if (separator <= 0) {
        throw new AppError({
          code: "invalid_header",
          exitCode: ExitCode.USAGE,
          message: `Expected "name: value", received "${value}".`,
        });
      }
      return [
        value.slice(0, separator).trim(),
        value.slice(separator + 1).trim(),
      ];
    })
  );

export const readInput = async (
  inputPath: string | undefined,
  cwd: string
): Promise<Record<string, unknown>> => {
  if (inputPath === undefined || inputPath === "") {
    return {};
  }
  const text =
    inputPath === "-"
      ? await Bun.stdin.text()
      : await readFile(path.resolve(cwd, inputPath), "utf-8");
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("expected an object");
    }
    return Object.fromEntries(Object.entries(value));
  } catch (error) {
    throw new AppError({
      cause: error,
      code: "invalid_json",
      exitCode: ExitCode.USAGE,
      message: `Input must contain one JSON object: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
};

export const curlCommand = (options: {
  baseUrl: string;
  path: string;
  method: string;
  headers: Readonly<Record<string, string>>;
  body?: unknown;
}): string => {
  const url = safeUrl(options.baseUrl, options.path);
  const tokenPlaceholder = ["$", "{", "CLI_TEMPLATE_TOKEN", "}"].join("");
  const parts = [
    "curl",
    "-sS",
    "-X",
    options.method,
    `'${url.toString()}'`,
    "-H",
    `'Authorization: Bearer ${tokenPlaceholder}'`,
  ];
  for (const [name, value] of Object.entries(options.headers)) {
    const safeValue = /authorization|cookie|token|api[-_]?key/iu.test(name)
      ? "<redacted>"
      : value.replaceAll("'", "'\\''");
    parts.push("-H", `'${name}: ${safeValue}'`);
  }
  if (options.body !== undefined) {
    const body = JSON.stringify(options.body).replaceAll("'", "'\\''");
    parts.push("-H", "'content-type: application/json'", "--data", `'${body}'`);
  }
  return parts.join(" ");
};
