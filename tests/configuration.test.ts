import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createConfiguration,
  loadRuleConfiguration,
  resolvePolicyConfiguration,
  resolveRuleConfiguration,
} from "../src/config/index.js";

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

describe("project rule configuration", () => {
  it("resolves thresholds, severity overrides, and disabled rules", () => {
    const configuration = resolveRuleConfiguration({
      $schema: "https://arcovia.ghazikhan.in/schema.json",
      rules: {
        "deeply-nested-jsx": { maxDepth: 10 },
        "large-component": { maxLines: 350, severity: "error" },
        "orphan-module": "off",
      },
    });

    expect(configuration.rules).toEqual({
      "deeply-nested-jsx": { maxDepth: 10 },
      "large-component": { maxLines: 350, severity: "error" },
      "orphan-module": "off",
    });
  });

  it("loads rule settings from .arcovia.json", async () => {
    const directory = await mkdtemp(join(tmpdir(), "arcovia-rule-config-"));
    try {
      await writeFile(
        join(directory, ".arcovia.json"),
        JSON.stringify({ rules: { "deeply-nested-jsx": { maxDepth: 12 } } }),
      );

      await expect(loadRuleConfiguration(directory)).resolves.toEqual({
        rules: { "deeply-nested-jsx": { maxDepth: 12 } },
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("allows rule settings alongside policy configuration", () => {
    const configuration = resolvePolicyConfiguration({
      rules: { "deeply-nested-jsx": { maxDepth: 10 } },
    });

    expect(configuration.policies).toEqual([]);
    expect(configuration.presets).toEqual([]);
  });

  it("rejects invalid rule configuration values", () => {
    expect(() => resolveRuleConfiguration({ rules: [] })).toThrow("rules must be an object");
    expect(() =>
      resolveRuleConfiguration({
        rules: { "deeply-nested-jsx": { maxDepth: -1 } },
      }),
    ).toThrow("non-negative finite number");
    expect(() =>
      resolveRuleConfiguration({
        rules: { "large-component": { severity: "fatal" } },
      }),
    ).toThrow("severity must be one of");
  });
});
