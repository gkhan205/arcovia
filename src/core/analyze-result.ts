import type { AnalysisReport } from "../domain/index.js";

/** Milliseconds spent in every Core Engine stage. */
export interface PipelineTiming {
  readonly builder: number;
  readonly graph: number;
  readonly parse: number;
  readonly rules: number;
  readonly scan: number;
  readonly score: number;
  readonly total: number;
}

/** Stable run counters available to callers without exposing implementation state. */
export interface PipelineStatistics {
  readonly components: number;
  readonly findings: number;
  readonly modules: number;
  readonly nodes: number;
  readonly sourceFiles: number;
}

/** Complete outcome returned by CoreEngine.analyze. */
export interface AnalyzeResult {
  readonly report: AnalysisReport;
  readonly statistics: PipelineStatistics;
  readonly timings: PipelineTiming;
}
