import type { RuleCategory, Severity } from "./rule.js";

/** A source location associated with a rule finding. */
export interface FindingLocation {
  readonly column: number;
  readonly file: string;
  readonly line: number;
  readonly symbol?: string;
}

/** JSON-compatible metadata attached to a finding. */
export type FindingMetadataValue =
  | boolean
  | number
  | string
  | null
  | readonly FindingMetadataValue[]
  | { readonly [key: string]: FindingMetadataValue };

/** A measurable fact supporting a rule finding. */
export interface FindingEvidence {
  readonly metric: string;
  readonly value: FindingMetadataValue;
}

/** A deterministic architecture issue reported by a rule. */
export interface Finding {
  readonly category: RuleCategory;
  readonly description: string;
  readonly id: string;
  readonly evidence: readonly FindingEvidence[];
  readonly location: FindingLocation;
  readonly metadata: Readonly<Record<string, FindingMetadataValue>>;
  readonly recommendation: string;
  readonly rationale: string;
  readonly ruleId: string;
  readonly severity: Severity;
  readonly title: string;
}
