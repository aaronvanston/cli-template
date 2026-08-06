import { describe, expect, test } from "bun:test";

import { apiEndpoints } from "../endpoints.ts";
import { filterEndpoints } from "../search.ts";

describe("endpoint search", () => {
  test("matches every word across method, path, metadata, and description", () => {
    expect(filterEndpoints(apiEndpoints, "patch selected fields")).toHaveLength(
      1
    );
    expect(
      filterEndpoints(apiEndpoints, "current health version")
    ).toHaveLength(1);
    expect(filterEndpoints(apiEndpoints, "deleteitem")).toHaveLength(1);
    expect(filterEndpoints(apiEndpoints, "missing endpoint")).toHaveLength(0);
  });

  test("returns the complete catalogue for an empty query", () => {
    expect(filterEndpoints(apiEndpoints, "")).toEqual(apiEndpoints);
    expect(filterEndpoints(apiEndpoints)).toEqual(apiEndpoints);
  });
});
