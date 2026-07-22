import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Severity, Severity as SeverityValue } from "../domain/index.js";
import { ConfigurationError } from "../errors/index.js";
import {
  type ArchitecturePolicy,
  type PolicyConfiguration,
  type PolicyDefinition,
  RECOMMENDED_POLICY_PRESET,
} from "../policies/index.js";

interface PolicyFile {
  readonly extends?: readonly string[];
  readonly policies?: readonly PolicyDefinition[];
  readonly policyScore?: Readonly<Partial<Record<Severity, number>>>;
}

const POLICY_FILE = ".arcovia.json";
const DEFAULT_SCORE_PENALTIES: Readonly<Partial<Record<Severity, number>>> = {
  [SeverityValue.Error]: 2,
  [SeverityValue.Info]: 0.1,
  [SeverityValue.Warning]: 0.5,
};

/** Loads and validates architecture policies from the analyzed project's root. */
export async function loadPolicyConfiguration(projectRoot: string): Promise<PolicyConfiguration> {
  const path = join(projectRoot, POLICY_FILE);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    if (isMissingFile(error)) return resolvePolicyConfiguration(undefined);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new ConfigurationError(`Unable to read ${POLICY_FILE}: ${message}`, [
      "Fix the JSON syntax or remove the invalid configuration file.",
    ]);
  }
  return resolvePolicyConfiguration(parsed);
}

/** Validates and merges a parsed policy file. Exported for deterministic tests and integrations. */
export function resolvePolicyConfiguration(value: unknown): PolicyConfiguration {
  if (value === undefined) return mergePolicies([], [], DEFAULT_SCORE_PENALTIES, "none", []);
  if (!isRecord(value)) throw invalid("Configuration must be a JSON object.");
  assertKnownKeys(value, ["extends", "policies", "policyScore"]);
  const file = value as PolicyFile;
  const extensions = validateExtensions(file.extends);
  const policies = validateDefinitions(file.policies ?? []);
  const presets = extensions.flatMap((extension) => {
    if (extension === "arcovia:recommended") return RECOMMENDED_POLICY_PRESET;
    throw invalid(`Unknown policy preset: ${extension}.`);
  });
  return mergePolicies(
    presets,
    policies,
    validateScorePenalties(file.policyScore),
    "project",
    extensions,
  );
}

function mergePolicies(
  presetPolicies: readonly PolicyDefinition[],
  projectPolicies: readonly PolicyDefinition[],
  scorePenalties: Readonly<Partial<Record<Severity, number>>>,
  source: PolicyConfiguration["source"],
  presets: readonly string[],
): PolicyConfiguration {
  const merged = new Map<string, ArchitecturePolicy>();
  for (const policy of presetPolicies)
    merged.set(policy.id, toArchitecturePolicy(policy, "preset"));
  for (const policy of projectPolicies) {
    if (policy.enabled === false) {
      merged.delete(policy.id);
      continue;
    }
    merged.set(policy.id, toArchitecturePolicy(policy, "project"));
  }
  return {
    policies: Object.freeze(
      [...merged.values()].sort((left, right) => left.id.localeCompare(right.id)),
    ),
    presets: Object.freeze([...presets]),
    scorePenalties: Object.freeze({ ...scorePenalties }),
    source,
  };
}

function toArchitecturePolicy(
  policy: PolicyDefinition,
  origin: ArchitecturePolicy["origin"],
): ArchitecturePolicy {
  if (policy.enabled === false) throw invalid(`Disabled policy ${policy.id} cannot be evaluated.`);
  if (
    policy.description === undefined ||
    policy.from === undefined ||
    policy.severity === undefined
  )
    throw invalid(`Policy ${policy.id} must define description, from, and severity.`);
  const hasAllow = policy.allow !== undefined;
  const hasDisallow = policy.disallow !== undefined;
  if (hasAllow === hasDisallow)
    throw invalid(`Policy ${policy.id} must define exactly one of allow or disallow.`);
  return {
    ...(policy.allow === undefined ? {} : { allow: policy.allow }),
    description: policy.description,
    ...(policy.disallow === undefined ? {} : { disallow: policy.disallow }),
    from: policy.from,
    id: policy.id,
    origin,
    recommendation:
      policy.recommendation ??
      "Respect the documented module boundary or introduce a shared abstraction.",
    severity: policy.severity,
  };
}

function validateDefinitions(value: readonly PolicyDefinition[]): readonly PolicyDefinition[] {
  if (!Array.isArray(value)) throw invalid("policies must be an array.");
  const seen = new Set<string>();
  return value.map((policy): PolicyDefinition => {
    if (!isRecord(policy) || typeof policy.id !== "string" || !/^[a-z][a-z0-9-]*$/u.test(policy.id))
      throw invalid("Each policy requires a lowercase kebab-case id.");
    if (seen.has(policy.id)) throw invalid(`Duplicate project policy ID: ${policy.id}.`);
    seen.add(policy.id);
    assertKnownKeys(policy, [
      "allow",
      "description",
      "disallow",
      "enabled",
      "from",
      "id",
      "recommendation",
      "severity",
    ]);
    if (policy.enabled === false) return { id: policy.id, enabled: false };
    if (typeof policy.description !== "string" || policy.description.length === 0)
      throw invalid(`Policy ${policy.id} requires a description.`);
    if (!isPatterns(policy.from))
      throw invalid(`Policy ${policy.id} requires a non-empty from array.`);
    if (policy.allow !== undefined && !isPatterns(policy.allow))
      throw invalid(`Policy ${policy.id} allow must be a non-empty array of patterns.`);
    if (policy.disallow !== undefined && !isPatterns(policy.disallow))
      throw invalid(`Policy ${policy.id} disallow must be a non-empty array of patterns.`);
    if (policy.allow !== undefined && policy.disallow !== undefined)
      throw invalid(`Policy ${policy.id} cannot define both allow and disallow.`);
    if (policy.allow === undefined && policy.disallow === undefined)
      throw invalid(`Policy ${policy.id} requires allow or disallow.`);
    if (!isSeverity(policy.severity)) throw invalid(`Policy ${policy.id} has an invalid severity.`);
    if (policy.recommendation !== undefined && typeof policy.recommendation !== "string")
      throw invalid(`Policy ${policy.id} recommendation must be a string.`);
    return policy as unknown as PolicyDefinition;
  });
}

function validateExtensions(value: readonly string[] | undefined): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((extension) => typeof extension !== "string"))
    throw invalid("extends must be an array of preset names.");
  if (new Set(value).size !== value.length)
    throw invalid("extends cannot contain duplicate presets.");
  return value;
}

function validateScorePenalties(
  value: PolicyFile["policyScore"],
): Readonly<Partial<Record<Severity, number>>> {
  if (value === undefined) return DEFAULT_SCORE_PENALTIES;
  if (!isRecord(value)) throw invalid("policyScore must be an object.");
  for (const [severity, penalty] of Object.entries(value)) {
    if (
      !isSeverity(severity) ||
      typeof penalty !== "number" ||
      !Number.isFinite(penalty) ||
      penalty < 0
    )
      throw invalid(
        "policyScore values must be non-negative finite numbers for info, warning, or error.",
      );
  }
  return value;
}

function isPatterns(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.length > 0)
  );
}
function isSeverity(value: unknown): value is Severity {
  return (
    value === SeverityValue.Info || value === SeverityValue.Warning || value === SeverityValue.Error
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
  return new ConfigurationError(`Invalid ${POLICY_FILE}: ${message}`, [
    "See https://arcovia.ghazikhan.in/guides/custom-policy-rules/ for the supported schema.",
  ]);
}
function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
