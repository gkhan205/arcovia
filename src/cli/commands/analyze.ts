import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Command } from "commander";

import {
  type AnalysisBenchmarkProfile,
  ConsoleReporter,
  parseAnalysisBenchmarkProfile,
} from "../../reporters/index.js";
import { createCliConfiguration } from "../config.js";
import type { CliDependencies } from "../dependencies.js";
import { CliError, ExitCode } from "../errors/index.js";
import { Progress } from "../ui/index.js";

/** Options accepted by the analyze command. */
export interface AnalyzeOptions {
  readonly benchmark?: string | true;
  readonly html?: boolean;
  readonly json?: boolean;
  readonly markdown?: boolean;
  readonly open?: boolean;
  readonly output?: string;
  readonly verbose?: boolean;
}

/** Registers the analyze command. */
export function register(program: Command, dependencies: CliDependencies): void {
  program
    .command("analyze [project-path]")
    .alias("analyse")
    .description("Analyze a project and generate requested reports")
    .option("--html", "generate an HTML report")
    .option("--json", "generate an analysis JSON artifact")
    .option("--markdown", "generate a Markdown report")
    .option("--open", "open the generated HTML report in your default browser")
    .option(
      "--benchmark [path]",
      "use Arcovia global bands or a custom benchmark profile JSON file",
    )
    .option("--output <path>", "write reports to a directory")
    .option("--verbose", "display verbose execution information")
    .action(async (projectPath: string | undefined, options: AnalyzeOptions) => {
      const progress = new Progress(dependencies.createSpinner());
      const cliConfiguration = createCliConfiguration(dependencies.configuration, options);
      const resolvedProjectPath = resolve(dependencies.currentDirectory(), projectPath ?? ".");
      const generateDefaultReports = !options.html && !options.json && !options.markdown;
      const generateHtml = options.html || options.open || generateDefaultReports;
      const outputPath =
        options.output === undefined
          ? join(resolvedProjectPath, ".arcovia-report")
          : resolve(dependencies.currentDirectory(), options.output);
      const benchmark =
        options.benchmark === undefined
          ? undefined
          : options.benchmark === true
            ? ARCOVIA_GLOBAL_BENCHMARK
            : await loadBenchmark(resolve(dependencies.currentDirectory(), options.benchmark));

      progress.start("Validating project");
      await validateProjectPath(resolvedProjectPath, dependencies);
      progress.succeed("Project validated");

      try {
        progress.start("Scanning project");
        const report = await dependencies.commandRunner.analyze({
          ...(benchmark === undefined ? {} : { benchmark }),
          generateHtml,
          generateJson: options.json ?? generateDefaultReports,
          generateMarkdown: options.markdown ?? false,
          outputPath,
          projectPath: resolvedProjectPath,
          verbose: cliConfiguration.verbose,
        });
        progress.succeed(
          `Scanned ${report.project.metadata.sourceFiles} files (${report.model.modules.length} modules)`,
        );
        progress.succeed(`Analysis completed in ${formatDuration(report.metadata.duration)}`);
        const reportUrl = generateHtml
          ? pathToFileURL(join(outputPath, "report.html")).href
          : undefined;
        const output = new ConsoleReporter().render(report, {
          cliVersion: dependencies.version,
          ...(generateHtml
            ? {
                htmlReportPath: reportPathForDisplay(
                  resolvedProjectPath,
                  outputPath,
                  "report.html",
                ),
              }
            : {}),
          openReport: options.open ?? false,
        });
        dependencies.standardOutput.write(output.stdout);
        if (output.stderr) dependencies.standardError.write(output.stderr);
        if (options.open && reportUrl !== undefined && dependencies.openReport !== undefined) {
          try {
            await dependencies.openReport(reportUrl);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            dependencies.standardError.write(
              `Report generated but could not be opened: ${message}\n`,
            );
          }
        }
      } catch (error) {
        progress.fail("Analysis failed");
        throw error;
      }
    });
}

function formatDuration(duration: number): string {
  return duration >= 1000 ? `${(duration / 1000).toFixed(1)} s` : `${Math.round(duration)} ms`;
}

function reportPathForDisplay(projectPath: string, outputPath: string, filename: string): string {
  const path = relative(projectPath, join(outputPath, filename));
  return path.length === 0 || path.startsWith("..") || isAbsolute(path)
    ? join(outputPath, filename)
    : path;
}

const ARCOVIA_GLOBAL_BENCHMARK: AnalysisBenchmarkProfile = {
  cohort: "Arcovia global quality bands",
  sampleSize: 0,
  score: { p25: 75, p50: 85, p75: 93 },
  version: "1.0.0",
};

async function loadBenchmark(path: string) {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    return parseAnalysisBenchmarkProfile(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new CliError(
      `Unable to load benchmark profile: ${message}`,
      ExitCode.InvalidArguments,
      ["Provide cohort, sampleSize, version, and score p25/p50/p75 values in JSON."],
      "BENCHMARK_INVALID",
    );
  }
}

async function validateProjectPath(path: string, dependencies: CliDependencies): Promise<void> {
  try {
    const stats = await dependencies.fileSystem.stat(path);

    if (!stats.isDirectory()) {
      throw projectNotFoundError(path);
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    throw projectNotFoundError(path);
  }
}

function projectNotFoundError(path: string): CliError {
  return new CliError(
    `Project not found: ${path}`,
    ExitCode.ProjectNotFound,
    ["Run: arcovia analyze ./project"],
    "PROJECT_NOT_FOUND",
  );
}
