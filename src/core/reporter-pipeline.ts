import { mkdir, rename, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { AnalysisReport } from "../domain/index.js";
import type { ConsoleReporter, HtmlReporter, JsonReporter } from "../reporters/index.js";

/** Requested outputs for one completed analysis. */
export interface ReporterOptions {
  readonly cliVersion?: string;
  readonly console?: boolean;
  readonly html?: boolean;
  readonly json?: boolean;
  readonly outputDirectory?: string;
}

/** Explicit output streams keep presentation I/O outside the Core Engine. */
export interface ReporterOutput {
  writeError(message: string): void;
  writeOutput(message: string): void;
}

/** Reporters and destination are injected so this pipeline remains independently testable. */
export interface ReporterPipelineDependencies {
  readonly consoleReporter: Pick<ConsoleReporter, "render">;
  readonly htmlReporter: Pick<HtmlReporter, "write">;
  readonly jsonReporter: Pick<JsonReporter, "write">;
  readonly now?: () => Date;
  readonly output: ReporterOutput;
}

/** Executes independently selectable report renderers after analysis has completed. */
export class ReporterPipeline {
  public constructor(private readonly dependencies: ReporterPipelineDependencies) {}

  public async execute(report: AnalysisReport, options: ReporterOptions = {}): Promise<void> {
    const directory = resolve(options.outputDirectory ?? ".");
    const jsonPath = join(directory, "analysis.json");
    const htmlPath = join(directory, "report.html");
    const outputFiles = [
      ...(options.json ? [basename(jsonPath)] : []),
      ...(options.html ? [basename(htmlPath)] : []),
    ];
    if (options.json || options.html) {
      await mkdir(directory, { recursive: true });
      await archiveLatestReports(directory, this.dependencies.now?.() ?? new Date());
    }
    if (options.json) {
      await this.dependencies.jsonReporter.write(jsonPath, report, {
        cliVersion: options.cliVersion ?? report.version,
        engineVersion: report.version,
        nodeVersion: report.metadata.nodeVersion,
        os: "unknown",
        platform: "unknown",
      });
    }
    if (options.html) {
      await this.dependencies.htmlReporter.write(htmlPath, report, {
        cliVersion: options.cliVersion ?? report.version,
        engineVersion: report.version,
        nodeVersion: report.metadata.nodeVersion,
      });
    }
    if (options.console ?? true) {
      const consoleOutput = this.dependencies.consoleReporter.render(report, {
        cliVersion: options.cliVersion ?? report.version,
        outputFiles,
      });
      this.dependencies.output.writeOutput(consoleOutput.stdout);
      if (consoleOutput.stderr) this.dependencies.output.writeError(consoleOutput.stderr);
    }
    if (options.html) {
      this.dependencies.output.writeOutput(`Open HTML report: ${pathToFileURL(htmlPath).href}\n`);
    }
  }
}

async function archiveLatestReports(directory: string, date: Date): Promise<void> {
  const timestamp = formatArchiveTimestamp(date);
  await Promise.all([
    archiveIfPresent(directory, "analysis", ".json", timestamp),
    archiveIfPresent(directory, "report", ".html", timestamp),
  ]);
}

async function archiveIfPresent(
  directory: string,
  name: string,
  extension: string,
  timestamp: string,
): Promise<void> {
  const latestPath = join(directory, `${name}${extension}`);
  if (!(await pathExists(latestPath))) return;

  let archivePath = join(directory, `${name}-${timestamp}${extension}`);
  let sequence = 2;
  while (await pathExists(archivePath)) {
    archivePath = join(directory, `${name}-${timestamp}-${sequence}${extension}`);
    sequence += 1;
  }
  await rename(latestPath, archivePath);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) return false;
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function formatArchiveTimestamp(date: Date): string {
  return date.toISOString().replaceAll(":", "-").replace(".", "-");
}
