/** Severity assigned to a deterministic architecture finding. */
export enum Severity {
  Info = "info",
  Warning = "warning",
  Error = "error",
  Critical = "critical",
}

/** Built-in and extensible categories for architecture rules. */
export type RuleCategory =
  | "architecture"
  | "components"
  | "complexity"
  | "context"
  | "hooks"
  | "imports"
  | "maintainability"
  | "naming"
  | "performance"
  | "routes"
  | (string & {});

/** Serializable metadata describing an architecture rule. */
export interface RuleMetadata {
  readonly category: RuleCategory;
  readonly description: string;
  readonly documentationUrl?: string;
  readonly estimatedRuntimeMs?: number;
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly version: string;
}
