import type { AnalysisReport } from "../domain/index.js";

import {
  type AnalysisBenchmarkProfile,
  type AnalysisJsonHistoryPoint,
  writeAnalysisJson,
} from "./analysis-json/index.js";

/** Options needed to serialize the canonical analysis artifact. */
export interface JsonReporterOptions {
  readonly benchmark?: AnalysisBenchmarkProfile;
  readonly cliVersion: string;
  readonly engineVersion: string;
  readonly history?: readonly AnalysisJsonHistoryPoint[];
  readonly nodeVersion: string;
  readonly os: string;
  readonly platform: string;
}

/** Dedicated file reporter for the versioned analysis.json artifact. */
export class JsonReporter {
  public async write(
    outputPath: string,
    report: AnalysisReport,
    options: JsonReporterOptions,
  ): Promise<void> {
    await writeAnalysisJson(outputPath, report, options);
  }
}
