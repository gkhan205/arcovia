import type { Finding } from "./finding.js";
import type { DependencyGraph } from "./graph.js";
import type { Metadata } from "./metadata.js";
import type { MetricCollection } from "./metric.js";
import type { ProjectModel } from "./model.js";
import type { PolicyConfigurationState, PolicyEvaluation } from "./policy.js";
import type { Project } from "./project.js";
import type { ArchitectureScore } from "./score.js";

/** The versioned, canonical artifact produced by Arcovia analysis. */
export interface AnalysisReport {
  readonly findings: readonly Finding[];
  readonly generatedAt: string;
  readonly graph: DependencyGraph;
  readonly metadata: Metadata;
  readonly metrics: MetricCollection;
  readonly model: ProjectModel;
  readonly project: Project;
  readonly policyEvaluations?: readonly PolicyEvaluation[];
  readonly policyConfiguration?: PolicyConfigurationState;
  readonly score: ArchitectureScore;
  readonly version: string;
}
