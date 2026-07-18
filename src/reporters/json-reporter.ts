import type { AnalysisReport } from "../domain/index.js";

import { writeAnalysisJson } from "./analysis-json/index.js";

/** Options needed to serialize the canonical analysis artifact. */
export interface JsonReporterOptions {
  readonly cliVersion: string;
  readonly engineVersion: string;
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
