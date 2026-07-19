import { describe, expect, it } from "vitest";

import { createConfiguration } from "../src/config/index.js";

describe("createConfiguration", () => {
  it("enables debug logging only for a true debug flag", () => {
    expect(createConfiguration({ ARCOVIA_DEBUG: "true" }).debug).toBe(true);
    expect(createConfiguration({ ARCOVIA_DEBUG: "FALSE" }).debug).toBe(false);
  });

  it("enables debug only for an explicit true value", () => {
    expect(createConfiguration({ ARCOVIA_DEBUG: "true" }).debug).toBe(true);
    expect(createConfiguration({ ARCOVIA_DEBUG: "false" }).debug).toBe(false);
  });
});
