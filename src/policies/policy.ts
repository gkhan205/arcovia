import type { PolicyConfigurationState, Severity } from "../domain/index.js";

/** User-authored architecture policy before preset merging. */
export interface PolicyDefinition {
  readonly allow?: readonly string[];
  readonly description?: string;
  readonly disallow?: readonly string[];
  readonly enabled?: boolean;
  readonly from?: readonly string[];
  readonly id: string;
  readonly recommendation?: string;
  readonly severity?: Severity;
}

/** Validated architecture policy ready for deterministic evaluation. */
export interface ArchitecturePolicy {
  readonly allow?: readonly string[];
  readonly description: string;
  readonly disallow?: readonly string[];
  readonly from: readonly string[];
  readonly id: string;
  readonly origin: "preset" | "project";
  readonly recommendation: string;
  readonly severity: Severity;
}

/** Policy settings resolved for one analysis run. */
export interface PolicyConfiguration extends PolicyConfigurationState {
  readonly policies: readonly ArchitecturePolicy[];
  readonly scorePenalties: Readonly<Partial<Record<Severity, number>>>;
}
