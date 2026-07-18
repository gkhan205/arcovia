import type {
  AnalysisReport,
  ArchitectureGraph,
  ArchitectureScore,
  Finding,
  Project,
  ProjectModel,
} from "../domain/index.js";

import type { PipelineTiming } from "./analyze-result.js";

/** Domain values required to compose the canonical AnalysisReport. */
export interface AnalysisBuilderInput {
  readonly findings: readonly Finding[];
  readonly graph: ArchitectureGraph;
  readonly model: ProjectModel;
  readonly project: Project;
  readonly score: ArchitectureScore;
  readonly timings: PipelineTiming;
}

/** Runtime details injected into report construction to keep it deterministic in tests. */
export interface AnalysisBuilderOptions {
  readonly clock?: () => Date;
  readonly nodeVersion?: string;
  readonly version: string;
}

/** Composes immutable domain outputs into the canonical analysis report. */
export class AnalysisBuilder {
  private readonly clock: () => Date;
  private readonly nodeVersion: string;

  public constructor(private readonly options: AnalysisBuilderOptions) {
    this.clock = options.clock ?? (() => new Date());
    this.nodeVersion = options.nodeVersion ?? "unknown";
  }

  public build(input: AnalysisBuilderInput): AnalysisReport {
    const generatedAt = this.clock().toISOString();
    return Object.freeze({
      findings: Object.freeze([...input.findings]),
      generatedAt,
      graph: input.graph,
      metadata: Object.freeze({
        arcoviaVersion: this.options.version,
        duration: input.timings.total,
        framework: input.project.framework,
        generatedAt,
        nodeVersion: this.nodeVersion,
        packageManager: input.project.packageManager,
      }),
      metrics: Object.freeze({
        components: input.model.components.length,
        contexts: input.model.contexts.length,
        cycles: input.graph.statistics.cycles,
        dependencies: input.graph.edges.length,
        exports: input.model.exports.length,
        hooks: input.model.hooks.length,
        imports: input.model.imports.length,
        totalFiles: input.project.metadata.sourceFiles,
      }),
      model: input.model,
      project: input.project,
      score: input.score,
      version: this.options.version,
    });
  }
}
