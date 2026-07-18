import { mkdir, readdir, readFile, rename, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { AnalysisReport } from "../domain/index.js";
import type {
  AnalysisBenchmarkProfile,
  AnalysisJsonHistoryPoint,
  ConsoleReporter,
  HtmlReporter,
  JsonReporter,
} from "../reporters/index.js";

/** Requested outputs for one completed analysis. */
export interface ReporterOptions {
  readonly benchmark?: AnalysisBenchmarkProfile;
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
    const history = await readArchiveHistory(join(directory, "history"));
    if (options.json) {
      await this.dependencies.jsonReporter.write(jsonPath, report, {
        ...(options.benchmark === undefined ? {} : { benchmark: options.benchmark }),
        cliVersion: options.cliVersion ?? report.version,
        engineVersion: report.version,
        history,
        nodeVersion: report.metadata.nodeVersion,
        os: "unknown",
        platform: "unknown",
      });
    }
    if (options.html) {
      await this.dependencies.htmlReporter.write(htmlPath, report, {
        ...(options.benchmark === undefined ? {} : { benchmark: options.benchmark }),
        cliVersion: options.cliVersion ?? report.version,
        engineVersion: report.version,
        history,
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
    if (options.html && (options.console ?? true)) {
      this.dependencies.output.writeOutput(`Open HTML report: ${pathToFileURL(htmlPath).href}\n`);
    }
  }
}

async function readArchiveHistory(directory: string): Promise<readonly AnalysisJsonHistoryPoint[]> {
  let entries: readonly string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (isMissingFileError(error)) return [];
    throw error;
  }
  const history = await Promise.all(
    entries
      .filter((entry) => /^analysis-.*\.json$/u.test(entry))
      .map(async (entry): Promise<AnalysisJsonHistoryPoint | undefined> => {
        try {
          const value = JSON.parse(await readFile(join(directory, entry), "utf8")) as unknown;
          if (!isHistoryArtifact(value)) return undefined;
          return {
            generatedAt: value.metadata.generatedAt,
            overallScore: value.summary.overallScore,
            reportPath: `history/${entry.replace(/^analysis-/u, "report-").replace(/\.json$/u, ".html")}`,
          };
        } catch {
          return undefined;
        }
      }),
  );
  return history
    .filter((entry): entry is AnalysisJsonHistoryPoint => entry !== undefined)
    .sort((left, right) => left.generatedAt.localeCompare(right.generatedAt))
    .slice(-7);
}

function isHistoryArtifact(value: unknown): value is {
  readonly metadata: { readonly generatedAt: string };
  readonly summary: { readonly overallScore: number };
} {
  if (
    typeof value !== "object" ||
    value === null ||
    !("metadata" in value) ||
    !("summary" in value)
  ) {
    return false;
  }
  const { metadata, summary } = value;
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "generatedAt" in metadata &&
    typeof metadata.generatedAt === "string" &&
    typeof summary === "object" &&
    summary !== null &&
    "overallScore" in summary &&
    typeof summary.overallScore === "number"
  );
}

async function archiveLatestReports(directory: string, date: Date): Promise<void> {
  const timestamp = formatArchiveTimestamp(date);
  const historyDirectory = join(directory, "history");
  await mkdir(historyDirectory, { recursive: true });
  await migrateLegacyArchives(directory, historyDirectory);
  await Promise.all([
    archiveIfPresent(directory, historyDirectory, "analysis", ".json", timestamp),
    archiveIfPresent(directory, historyDirectory, "report", ".html", timestamp),
  ]);
}

async function migrateLegacyArchives(directory: string, historyDirectory: string): Promise<void> {
  const entries = await readdir(directory);
  await Promise.all(
    entries
      .filter((entry) => /^(analysis-.*\.json|report-.*\.html)$/u.test(entry))
      .map(async (entry) =>
        moveToAvailablePath(join(directory, entry), join(historyDirectory, entry)),
      ),
  );
}

async function archiveIfPresent(
  directory: string,
  historyDirectory: string,
  name: string,
  extension: string,
  timestamp: string,
): Promise<void> {
  const latestPath = join(directory, `${name}${extension}`);
  if (!(await pathExists(latestPath))) return;

  await moveToAvailablePath(latestPath, join(historyDirectory, `${name}-${timestamp}${extension}`));
}

async function moveToAvailablePath(sourcePath: string, intendedPath: string): Promise<void> {
  let destinationPath = intendedPath;
  let sequence = 2;
  while (await pathExists(destinationPath)) {
    const extensionIndex = intendedPath.lastIndexOf(".");
    const base = extensionIndex < 0 ? intendedPath : intendedPath.slice(0, extensionIndex);
    const extension = extensionIndex < 0 ? "" : intendedPath.slice(extensionIndex);
    destinationPath = `${base}-${sequence}${extension}`;
    sequence += 1;
  }
  await rename(sourcePath, destinationPath);
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
