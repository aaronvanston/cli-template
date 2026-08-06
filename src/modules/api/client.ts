import { AppError, createServiceToken, ExitCode } from "../../engine/index.ts";
import type { ServiceProvider } from "../../engine/services.ts";
import type { ApiClient, ApiRequest, ApiResponse } from "./types.ts";

export const apiClient = createServiceToken<ApiClient>("api-client");

const exitCodeForStatus = (status: number) => {
  if (status === 401 || status === 403) {
    return ExitCode.NOPERM;
  }
  if (status >= 500) {
    return ExitCode.TEMPFAIL;
  }
  return ExitCode.ERROR;
};

const configuredBaseUrl = (): string =>
  process.env.CLI_TEMPLATE_BASE_URL ?? "http://127.0.0.1:8787";

export const safeUrl = (baseUrl: string, path: string): URL => {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new AppError({
      code: "invalid_api_path",
      exitCode: ExitCode.USAGE,
      message: `API paths must start with one "/" and stay on the configured origin: ${path}`,
    });
  }
  const base = new URL(baseUrl);
  const url = new URL(path, base);
  if (url.origin !== base.origin) {
    throw new AppError({
      code: "api_origin_mismatch",
      exitCode: ExitCode.NOPERM,
      message: "The request path resolves outside the configured API origin.",
    });
  }
  return url;
};

class FetchApiClient implements ApiClient {
  readonly baseUrl: string;
  readonly #token: string | undefined;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = new URL(baseUrl).toString().replace(/\/$/u, "");
    this.#token = token;
  }

  async request(request: ApiRequest): Promise<ApiResponse> {
    const url = safeUrl(this.baseUrl, request.path);
    const timeout = AbortSignal.timeout(request.timeoutMs);
    const signal = AbortSignal.any([request.signal, timeout]);
    const headers = new Headers(request.headers);
    headers.set("accept", "application/json, text/plain;q=0.9, */*;q=0.8");
    if (this.#token !== undefined && this.#token !== "") {
      headers.set("authorization", `Bearer ${this.#token}`);
    }
    let body: string | undefined;
    if (request.body !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(request.body);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...(body === undefined ? {} : { body }),
        headers,
        method: request.method,
        signal,
      });
    } catch (error) {
      const timedOut = timeout.aborted && !request.signal.aborted;
      throw new AppError({
        cause: error,
        code: timedOut ? "api_timeout" : "api_unreachable",
        exitCode: ExitCode.TEMPFAIL,
        hint: `Check CLI_TEMPLATE_BASE_URL (${this.baseUrl}) and retry.`,
        message: timedOut
          ? `The API did not respond within ${request.timeoutMs}ms.`
          : `Could not reach ${url.origin}.`,
      });
    }

    const text = await response.text();
    let responseBody: unknown = text;
    if (text === "") {
      responseBody = null;
    } else {
      const contentType = response.headers.get("content-type");
      const looksLikeJson =
        contentType?.includes("json") === true ||
        /^[{[]/u.test(text.trimStart());
      if (looksLikeJson) {
        try {
          responseBody = JSON.parse(text) as unknown;
        } catch {
          responseBody = text;
        }
      }
    }
    const responseHeaders = Object.fromEntries(response.headers.entries());

    if (response.ok) {
      return {
        body: responseBody,
        headers: responseHeaders,
        status: response.status,
        statusText: response.statusText,
      };
    }

    throw new AppError({
      code: `api_${response.status}`,
      details: responseBody,
      exitCode: exitCodeForStatus(response.status),
      ...(response.status === 401
        ? {
            hint: "Set CLI_TEMPLATE_TOKEN or sign in through the generated CLI.",
          }
        : {}),
      message: `API request failed with ${response.status} ${response.statusText}.`,
    });
  }
}

export const apiClientProvider: ServiceProvider<ApiClient> = {
  create() {
    return new FetchApiClient(
      configuredBaseUrl(),
      process.env.CLI_TEMPLATE_TOKEN
    );
  },
  token: apiClient,
};

export const apiConfigurationCheck = () => {
  const baseUrl = configuredBaseUrl();
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return {
      detail: url.origin,
      name: "API base URL",
      status: "pass" as const,
    };
  } catch {
    return {
      detail: `Invalid URL: ${baseUrl}`,
      fix: "Set CLI_TEMPLATE_BASE_URL to an http:// or https:// URL.",
      name: "API base URL",
      status: "fail" as const,
    };
  }
};
