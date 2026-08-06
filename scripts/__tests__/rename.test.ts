import { describe, expect, test } from "bun:test";

import {
  environmentPrefix,
  replaceTemplateTokens,
  titleCase,
} from "../rename.ts";

describe("template rename", () => {
  test("derives display, package, and environment names", () => {
    expect(titleCase("acme-tools")).toBe("Acme Tools");
    expect(environmentPrefix("acme-tools")).toBe("ACME_TOOLS");
    expect(
      replaceTemplateTokens(
        "CLI Template cli-template CLI_TEMPLATE CliTemplate",
        "acme-tools"
      )
    ).toBe("Acme Tools acme-tools ACME_TOOLS AcmeTools");
  });
});
