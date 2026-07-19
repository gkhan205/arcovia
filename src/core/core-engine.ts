import { createConfiguration } from "../config/index.js";
import type {
  AnalysisReport,
  ArchitectureGraph,
  ArchitectureScore,
  Finding,
  Project,
  ProjectModel,
} from "../domain/index.js";
import type { RuleConfiguration } from "../rules/index.js";
import { Logger } from "../shared/index.js";

import type { AnalysisBuilder, AnalysisBuilderInput } from "./analysis-builder.js";
import type { AnalyzeOptions, ProgressEvent } from "./analyze-options.js";
import type { AnalyzeResult, PipelineTiming } from "./analyze-result.js";
import { AnalysisAbortedError, PipelineError } from "./engine-errors.js";

/** Dependency ports owned by the existing analysis stages. */
export interface CoreEngineDependencies {
  readonly analysisBuilder: Pick<AnalysisBuilder, "build">;
  readonly graphBuilder: { build(model: ProjectModel): ArchitectureGraph };
  readonly ruleConfiguration: RuleConfiguration;
  readonly ruleEngine: {
    execute(context: {
      readonly configuration: RuleConfiguration;
      readonly graph: ArchitectureGraph;
      readonly logger: Logger;
      readonly model: ProjectModel;
      readonly project: Project;
    }): Promise<readonly Finding[]>;
  };
  readonly scanner: { scan(options: { readonly projectPath: string }): Promise<Project> };
  readonly scoreEngine: {
    calculate(input: {
      readonly findings: readonly Finding[];
      readonly graph: ArchitectureGraph;
      readonly metrics: AnalysisReport["metrics"];
      readonly model: ProjectModel;
      readonly project: Project;
    }): ArchitectureScore;
  };
  readonly parser: { parse(input: { readonly project: Project }): ProjectModel };
}

const EMPTY_CONFIGURATION = createConfiguration({});
const DEFAULT_LOGGER = new Logger({ level: "ERROR", writer: { write: () => undefined } });
type MutablePipelineTiming = { -readonly [key in keyof PipelineTiming]: PipelineTiming[key] };

/** Thin, dependency-injected coordinator for the architecture analysis pipeline. */
export class CoreEngine {
  public constructor(private readonly dependencies: CoreEngineDependencies) {}

  public async analyze(options: AnalyzeOptions): Promise<AnalyzeResult> {
    const startedAt = performance.now();
    const logger = options.logger ?? DEFAULT_LOGGER;
    const configuration = options.configuration ?? EMPTY_CONFIGURATION;
    const timings: MutablePipelineTiming = {
      builder: 0,
      graph: 0,
      parse: 0,
      rules: 0,
      scan: 0,
      score: 0,
      total: 0,
    };
    logger.debug(`Pipeline started for ${options.projectPath}.`);
    logger.debug(`Pipeline configuration: debug=${configuration.debug}.`);

    const project = await this.stage("scan", "Scanning project", options, logger, timings, () =>
      this.dependencies.scanner.scan({ projectPath: options.projectPath }),
    );
    const model = await this.stage("parse", "Parsing project", options, logger, timings, () =>
      this.dependencies.parser.parse({ project }),
    );
    const graph = await this.stage(
      "graph",
      "Building architecture graph",
      options,
      logger,
      timings,
      () => this.dependencies.graphBuilder.build(model),
    );
    const findings = await this.stage(
      "rules",
      "Executing architecture rules",
      options,
      logger,
      timings,
      () =>
        this.dependencies.ruleEngine.execute({
          configuration: this.dependencies.ruleConfiguration,
          graph,
          logger,
          model,
          project,
        }),
    );
    const metrics = createMetrics(project, model, graph);
    const score = await this.stage(
      "score",
      "Calculating architecture score",
      options,
      logger,
      timings,
      () => this.dependencies.scoreEngine.calculate({ findings, graph, metrics, model, project }),
    );
    timings.total = performance.now() - startedAt;
    const report = await this.stage(
      "report",
      "Building analysis report",
      options,
      logger,
      timings,
      () =>
        this.dependencies.analysisBuilder.build({
          findings,
          graph,
          model,
          project,
          score,
          timings,
        } satisfies AnalysisBuilderInput),
    );
    timings.total = performance.now() - startedAt;
    logger.debug(`Pipeline complete in ${Math.round(timings.total)}ms.`);
    return Object.freeze({
      report,
      statistics: Object.freeze({
        components: model.components.length,
        findings: findings.length,
        modules: model.modules.length,
        nodes: graph.nodes.length,
        sourceFiles: project.metadata.sourceFiles,
      }),
      timings: Object.freeze({ ...timings }),
    });
  }

  private async stage<T>(
    stage: ProgressEvent["stage"],
    message: string,
    options: AnalyzeOptions,
    logger: Logger,
    timings: MutablePipelineTiming,
    execute: () => T | Promise<T>,
  ): Promise<T> {
    this.throwIfAborted(options.signal);
    options.onProgress?.({ message, progress: progressFor(stage), stage });
    logger.debug(`${message}.`);
    const startedAt = performance.now();
    try {
      const result = await execute();
      timings[timingKey(stage)] = performance.now() - startedAt;
      this.throwIfAborted(options.signal);
      logger.debug(`${message} complete.`);
      return result;
    } catch (error) {
      if (error instanceof AnalysisAbortedError) throw error;
      logger.error(`${message} failed.`);
      throw new PipelineError(stage, error);
    }
  }

  private throwIfAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted) throw new AnalysisAbortedError();
  }
}

function createMetrics(
  project: Project,
  model: ProjectModel,
  graph: ArchitectureGraph,
): AnalysisReport["metrics"] {
  return {
    components: model.components.length,
    contexts: model.contexts.length,
    cycles: graph.statistics.cycles,
    dependencies: graph.edges.length,
    exports: model.exports.length,
    hooks: model.hooks.length,
    imports: model.imports.length,
    totalFiles: project.metadata.sourceFiles,
  };
}
function progressFor(stage: ProgressEvent["stage"]): number {
  return { scan: 16, parse: 33, graph: 50, rules: 66, score: 83, report: 100 }[stage];
}
function timingKey(stage: ProgressEvent["stage"]): Exclude<keyof PipelineTiming, "total"> {
  return stage === "report" ? "builder" : stage;
}
