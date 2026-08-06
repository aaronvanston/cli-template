import type { ApiEndpoint, HttpMethod } from "./types.ts";

export const apiEndpoints: readonly ApiEndpoint[] = [
  {
    description: "Returns the current health and version of the local service.",
    method: "GET",
    mutates: false,
    operationId: "getHealth",
    path: "/health",
    summary: "Read service health",
    tags: ["system"],
  },
  {
    description: "Returns the in-memory items exposed by the example server.",
    method: "GET",
    mutates: false,
    operationId: "listItems",
    path: "/items",
    summary: "List example items",
    tags: ["items"],
  },
  {
    description: "Creates one item from a JSON body containing a name.",
    method: "POST",
    mutates: true,
    operationId: "createItem",
    path: "/items",
    summary: "Create an example item",
    tags: ["items"],
  },
  {
    description: "Returns one item selected by its identifier.",
    method: "GET",
    mutates: false,
    operationId: "getItem",
    path: "/items/{id}",
    summary: "Read an example item",
    tags: ["items"],
  },
  {
    description: "Replaces the selected item from a complete JSON body.",
    method: "PUT",
    mutates: true,
    operationId: "replaceItem",
    path: "/items/{id}",
    summary: "Replace an example item",
    tags: ["items"],
  },
  {
    description: "Updates selected fields on one example item.",
    method: "PATCH",
    mutates: true,
    operationId: "updateItem",
    path: "/items/{id}",
    summary: "Update an example item",
    tags: ["items"],
  },
  {
    description: "Deletes one item from the in-memory example server.",
    method: "DELETE",
    mutates: true,
    operationId: "deleteItem",
    path: "/items/{id}",
    summary: "Delete an example item",
    tags: ["items"],
  },
];

export const findEndpoint = (
  method: HttpMethod,
  path: string
): ApiEndpoint | undefined => {
  const normalized = path.split("?")[0] ?? path;
  return apiEndpoints.find((endpoint) => {
    if (endpoint.method !== method) {
      return false;
    }
    const pattern = endpoint.path.replaceAll(/\{[^/]+\}/gu, "[^/]+");
    return new RegExp(`^${pattern}$`, "u").test(normalized);
  });
};
