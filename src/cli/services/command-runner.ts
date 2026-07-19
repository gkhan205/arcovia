import type { AnalysisReport } from "../../domain/index.js";
import type { AnalysisBenchmarkProfile } from "../../reporters/index.js";

/** Input passed from the analyze command to the Core Engine. */
export interface AnalyzeProjectInput {
  readonly benchmark?: AnalysisBenchmarkProfile;
  readonly generateHtml: boolean;
  readonly generateJson: boolean;
  readonly generateMarkdown: boolean;
  readonly outputPath?: string;
  readonly projectPath: string;
  readonly verbose: boolean;
}

export type { AnalysisReport } from "../../domain/index.js";

/** Boundary between the CLI and the Core Engine. */
export interface CommandRunner {
  analyze(input: AnalyzeProjectInput): Promise<AnalysisReport>;
}
