import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Severity as SeverityValue } from "../domain/index.js";
import { ConfigurationError } from "../errors/index.js";
import type {
  RuleConfiguration,
  RuleLevel,
  RuleOptions,
  RuleSetting,
} from "../rules/index.js";

interface RuleFile {
  readonly $schema?: unknown;
  readonly rules?: unknown;
}

const CONFIG_FILE = ".arcovia.json";

/** Loads and validates built-in rule settings from the analyzed project's root. */
export async function loadRuleConfiguration(projectRoot: string): Promise<RuleConfiguration> {
  const path = join(projectRoot, CONFIG_FILE);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    if (isMissingFile(error)) return { rules: {} };
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new ConfigurationError(`Unable to read ${CONFIG_FILE}: ${message}`, [
      "Fix the JSON syntax or remove the invalid configuration file.",
    ]);
  }
  return resolveRuleConfiguration(parsed);
}

/** Validates built-in rule settings from a parsed .arcovia.json value. */
export function resolveRuleConfiguration(value: unknown): RuleConfiguration {
  if (value === undefined) return { rules: {} };
  if (!isRecord(value)) throw invalid("Configuration must be a JSON object.");
  assertKnownKeys(value, ["$schema", "extends", "policies", "policyScore", "rules"]);
  const file = value as RuleFile;
  return { rules: validateRules(file.rules) };
}

function validateRules(value: unknown): Readonly<Record<string, RuleSetting | undefined>> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw invalid("rules must be an object.");

  const rules: Record<string, RuleSetting> = {};
  for (const [ruleId, setting] of Object.entries(value)) {
    if (ruleId.length === 0) throw invalid("Rule IDs cannot be empty.");
    rules[ruleId] = validateRuleSetting(ruleId, setting);
  }
  return Object.freeze(rules);
}

function validateRuleSetting(ruleId: string, value: unknown): RuleSetting {
  if (isRuleLevel(value)) return value;
  if (!isRecord(value))
    throw invalid(`Rule ${ruleId} must be a severity level or an options object.`);

  const options: Record<string, boolean | number | string | undefined> = {};
  for (const [name, setting] of Object.entries(value)) {
    if (name === "severity") {
      if (!isRuleLevel(setting))
        throw invalid(
          `Rule ${ruleId} severity must be one of off, info, warning, error, or critical.`,
        );
      options[name] = setting;
      continue;
    }

    if (typeof setting === "number") {
      if (!Number.isFinite(setting) || setting < 0)
        throw invalid(
          `Rule ${ruleId} setting ${name} must be a non-negative finite number.`,
        );
      options[name] = setting;
      continue;
    }

    if (typeof setting === "string" || typeof setting === "boolean") {
      options[name] = setting;
      continue;
    }

    throw invalid(
      `Rule ${ruleId} setting ${name} must be a string, boolean, or non-negative finite number.`,
    );
  }

  return Object.freeze(options) as RuleOptions;
}

function isRuleLevel(value: unknown): value is RuleLevel {
  return (
    value === "off" ||
    value === SeverityValue.Info ||
    value === SeverityValue.Warning ||
    value === SeverityValue.Error ||
    value === SeverityValue.Critical
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertKnownKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown !== undefined) throw invalid(`Unknown configuration field: ${unknown}.`);
}

function invalid(message: string): ConfigurationError {
  return new ConfigurationError(`Invalid ${CONFIG_FILE}: ${message}`, [
    "See https://arcovia.ghazikhan.in/guides/custom-policy-rules/ for the supported schema.",
  ]);
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
