/** Stage-aware failure that preserves the original error as its cause. */
export class PipelineError extends Error {
  public constructor(
    public readonly stage: "scan" | "parse" | "graph" | "rules" | "score" | "report",
    cause: unknown,
  ) {
    super(`Arcovia analysis failed during ${stage}.`, { cause });
    this.name = "PipelineError";
  }
}

/** Raised before a stage begins when its analysis was cancelled. */
export class AnalysisAbortedError extends Error {
  public constructor() {
    super("Arcovia analysis was cancelled.");
    this.name = "AnalysisAbortedError";
  }
}
