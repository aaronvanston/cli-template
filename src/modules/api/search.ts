import type { Ui } from "../../engine/index.ts";
import type { ApiEndpoint } from "./types.ts";

export const endpointSearchText = (endpoint: ApiEndpoint): string =>
  [
    endpoint.method,
    endpoint.path,
    endpoint.operationId,
    endpoint.summary,
    endpoint.description,
    ...endpoint.tags,
  ]
    .join(" ")
    .toLowerCase();

export const filterEndpoints = (
  endpoints: readonly ApiEndpoint[],
  term?: string
): readonly ApiEndpoint[] => {
  const query = term?.trim().toLowerCase();
  if (query === undefined || query === "") {
    return endpoints;
  }
  const words = query.split(/\s+/u);
  return endpoints.filter((endpoint) => {
    const searchable = endpointSearchText(endpoint);
    return words.every((word) => searchable.includes(word));
  });
};

export const searchEndpoints = async (options: {
  endpoints: readonly ApiEndpoint[];
  signal: AbortSignal;
  ui: Ui;
}): Promise<ApiEndpoint | undefined> => {
  const { autocomplete, isCancel } = await import("@clack/prompts");
  const selection = await autocomplete<ApiEndpoint>({
    filter(search, option) {
      return filterEndpoints([option.value], search).length > 0;
    },
    input: process.stdin,
    maxItems: 8,
    message: `Search for an API endpoint (${options.endpoints.length} available)`,
    options: options.endpoints.map((endpoint) => ({
      hint:
        endpoint.description === "" ? endpoint.summary : endpoint.description,
      label: `${options.ui.httpMethodPadded(endpoint.method)} ${endpoint.path}`,
      value: endpoint,
    })),
    output: process.stderr,
    signal: options.signal,
  });
  return isCancel(selection) ? undefined : selection;
};
