import picocolors from "picocolors";

export type ColorMode = "auto" | "always" | "never";

export interface StyleOptions {
  colorMode: ColorMode;
  machine: boolean;
  streamIsTty: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface Symbols {
  active: string;
  error: string;
  pending: string;
  success: string;
  warning: string;
}

export interface Ui {
  readonly colorEnabled: boolean;
  readonly symbols: Symbols;
  brand: (value: string) => string;
  command: (value: string) => string;
  danger: (value: string) => string;
  flag: (value: string) => string;
  heading: (value: string) => string;
  httpMethod: (method: string, value?: string) => string;
  httpMethodPadded: (method: string, width?: number) => string;
  info: (value: string) => string;
  muted: (value: string) => string;
  success: (value: string) => string;
  warning: (value: string) => string;
  table: (
    headers: readonly string[],
    rows: readonly (readonly unknown[])[]
  ) => string;
}

const ansiPattern =
  // oxlint-disable-next-line no-control-regex -- ANSI escape stripping
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/gu;

export const stripAnsi = (value: string): string =>
  value.replace(ansiPattern, "");

const colorIsEnabled = (options: StyleOptions): boolean => {
  if (options.machine || options.colorMode === "never") {
    return false;
  }
  if (options.colorMode === "always") {
    return true;
  }
  const env = options.env ?? process.env;
  if ("NO_COLOR" in env || env.FORCE_COLOR === "0" || env.TERM === "dumb") {
    return false;
  }
  return options.streamIsTty;
};

const unicodeIsSuitable = (env: NodeJS.ProcessEnv): boolean => {
  if (env.TERM === "dumb") {
    return false;
  }
  const locale = `${env.LC_ALL ?? ""}${env.LC_CTYPE ?? ""}${env.LANG ?? ""}`;
  return locale === "" || /utf-?8/iu.test(locale);
};

const stringifyCell = (cell: unknown): string => {
  if (cell === null || cell === undefined) {
    return "";
  }
  if (
    typeof cell === "string" ||
    typeof cell === "number" ||
    typeof cell === "bigint" ||
    typeof cell === "boolean"
  ) {
    return String(cell);
  }
  return JSON.stringify(cell) ?? "";
};

export const createUi = (options: StyleOptions): Ui => {
  const enabled = colorIsEnabled(options);
  const color = picocolors.createColors(enabled);
  const unicode = unicodeIsSuitable(options.env ?? process.env);
  const httpMethod = (method: string, value = method): string => {
    switch (method.toUpperCase()) {
      case "GET": {
        return color.cyan(value);
      }
      case "POST": {
        return color.green(value);
      }
      case "PUT": {
        return color.yellow(value);
      }
      case "PATCH": {
        return color.blue(value);
      }
      case "DELETE": {
        return color.red(value);
      }
      default: {
        return value;
      }
    }
  };
  const symbols: Symbols = unicode
    ? { active: "●", error: "✗", pending: "○", success: "✓", warning: "!" }
    : {
        active: "[*]",
        error: "[error]",
        pending: "[-]",
        success: "[ok]",
        warning: "[warn]",
      };

  return {
    brand: color.magenta,
    colorEnabled: enabled,
    command: color.bold,
    danger: color.red,
    flag: color.cyan,
    heading: color.bold,
    httpMethod,
    httpMethodPadded(method, width = 7) {
      const normalized = method.toUpperCase();
      const padding = " ".repeat(Math.max(0, width - normalized.length));
      return `${httpMethod(normalized)}${padding}`;
    },
    info: color.blue,
    muted: color.dim,
    success: color.green,
    symbols,
    table(headers, rows) {
      const values = [headers, ...rows].map((row) => row.map(stringifyCell));
      const widths = headers.map((_, column) =>
        Math.min(
          48,
          Math.max(
            ...values.map((row) =>
              Bun.stringWidth(stripAnsi(row[column] ?? ""), {
                countAnsiEscapeCodes: false,
              })
            )
          )
        )
      );
      return values
        .map((row, rowIndex) =>
          row
            .map((cell, column) => {
              const width = widths[column] ?? 0;
              const visible = Bun.stringWidth(stripAnsi(cell), {
                countAnsiEscapeCodes: false,
              });
              const padded = `${cell}${" ".repeat(Math.max(0, width - visible))}`;
              return rowIndex === 0 ? color.bold(padded) : padded;
            })
            .join("  ")
            .trimEnd()
        )
        .join("\n");
    },
    warning: color.yellow,
  };
};
