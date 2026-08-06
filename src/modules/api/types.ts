import { z } from "zod";

export const httpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
export type HttpMethod = z.infer<typeof httpMethodSchema>;

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  operationId: string;
  summary: string;
  description: string;
  tags: readonly string[];
  mutates: boolean;
}

export interface ApiRequest {
  path: string;
  method: HttpMethod;
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
  timeoutMs: number;
  signal: AbortSignal;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Readonly<Record<string, string>>;
  body: unknown;
}

export interface ApiClient {
  readonly baseUrl: string;
  request: (request: ApiRequest) => Promise<ApiResponse>;
}
