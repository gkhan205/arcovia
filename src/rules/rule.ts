import type {
  ArchitectureGraph,
  Finding,
  Project,
  ProjectModel,
  RuleCategory,
  Severity,
} from "../domain/index.js";
import type { Logger } from "../shared/index.js";

/** Configurable severity level for an individual rule. */
export type RuleLevel = "off" | Severity;

/** Per-rule settings including optional threshold overrides. */
export interface RuleOptions {
  readonly severity?: RuleLevel;
  readonly [setting: string]: boolean | number | string | undefined;
}

/** A configured rule level or detailed options object. */
export type RuleSetting = RuleLevel | RuleOptions;

/** Rule settings resolved before scheduling. */
export interface RuleConfiguration {
  readonly concurrency?: number;
  readonly rules: Readonly<Record<string, RuleSetting | undefined>>;
  readonly timeoutMs?: number;
}

/** Immutable data made available to every rule. */
export interface RuleContext {
  readonly configuration: RuleConfiguration;
  readonly graph: ArchitectureGraph;
  readonly logger: Logger;
  readonly model: ProjectModel;
  readonly project: Project;
}

/** A stateless, deterministic architecture rule. */
export interface Rule {
  readonly category: RuleCategory;
  readonly defaultSeverity: Severity;
  readonly description: string;
  readonly documentationUrl?: string;
  readonly estimatedRuntimeMs?: number;
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly version: string;
  execute(context: RuleContext): Promise<readonly Finding[]>;
  supports(context: RuleContext): boolean;
}
