import { describe, expect, it } from "vitest";

import { createConfiguration } from "../src/config/index.js";

describe("createConfiguration", () => {
  it("enables debug logging only for a true debug flag", () => {
    expect(createConfiguration({ ARCOVIA_DEBUG: "true" }).debug).toBe(true);
    expect(createConfiguration({ ARCOVIA_DEBUG: "FALSE" }).debug).toBe(false);
  });

  it("trims API keys and excludes empty values", () => {
    expect(createConfiguration({ OPENAI_API_KEY: "  key  " }).openAiApiKey).toBe("key");
    expect(createConfiguration({ OPENAI_API_KEY: "  " }).openAiApiKey).toBeUndefined();
  });
});
