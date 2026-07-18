import { join, resolve } from "node:path";
import type { Command } from "commander";

import { createCliConfiguration } from "../config.js";
import type { CliDependencies } from "../dependencies.js";
import { CliError, ExitCode } from "../errors/index.js";
import { Progress } from "../ui/index.js";

/** Options accepted by the analyze command. */
export interface AnalyzeOptions {
  readonly ai?: boolean;
  readonly html?: boolean;
  readonly json?: boolean;
  readonly markdown?: boolean;
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
    .option("--ai", "include an optional AI review")
    .option("--output <path>", "write reports to a directory")
    .option("--verbose", "display verbose execution information")
    .action(async (projectPath: string | undefined, options: AnalyzeOptions) => {
      const progress = new Progress(dependencies.createSpinner());
      const cliConfiguration = createCliConfiguration(dependencies.configuration, options);
      const resolvedProjectPath = resolve(dependencies.currentDirectory(), projectPath ?? ".");
      const generateDefaultReports = !options.html && !options.json && !options.markdown;
      const outputPath =
        options.output === undefined
          ? join(resolvedProjectPath, ".arcovia-report")
          : resolve(dependencies.currentDirectory(), options.output);

      progress.start("Validating project path");
      await validateProjectPath(resolvedProjectPath, dependencies);
      progress.succeed("Validated project path");

      try {
        progress.start("Analyzing project");
        const report = await dependencies.commandRunner.analyze({
          ai: options.ai ?? false,
          generateHtml: options.html ?? generateDefaultReports,
          generateJson: options.json ?? generateDefaultReports,
          generateMarkdown: options.markdown ?? false,
          outputPath,
          projectPath: resolvedProjectPath,
          verbose: cliConfiguration.verbose,
        });
        progress.succeed("Analysis complete");
        dependencies.standardOutput.write(`Analysis complete: ${report.project.root}\n`);
      } catch (error) {
        progress.fail("Analysis failed");
        throw error;
      }
    });
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
