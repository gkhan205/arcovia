import type { Severity } from "./rule.js";

/** The source and active preset packs for one policy evaluation run. */
export interface PolicyConfigurationState {
  readonly presets: readonly string[];
  readonly source: "none" | "project";
}

/** A policy outcome retained even when a policy has no violations. */
export interface PolicyEvaluation {
  readonly description: string;
  readonly id: string;
  readonly origin: "preset" | "project";
  readonly severity: Severity;
  readonly status: "passed" | "failed";
  readonly violationCount: number;
  readonly files: readonly string[];
}
