import type { Configuration } from "../config/index.js";
import type { Logger } from "../shared/index.js";

/** Inputs controlled by a caller when starting one analysis run. */
export interface AnalyzeOptions {
  readonly configuration?: Configuration;
  readonly logger?: Logger;
  readonly onProgress?: ProgressListener;
  readonly projectPath: string;
  readonly signal?: AbortSignal;
}

/** A non-UI progress notification emitted by the orchestration layer. */
export interface ProgressEvent {
  readonly message: string;
  readonly progress: number;
  readonly stage: "scan" | "parse" | "graph" | "rules" | "score" | "report";
}

export type ProgressListener = (event: ProgressEvent) => void;
