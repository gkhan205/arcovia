#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CommanderError } from "commander";

import { createDefaultDependencies } from "./default-dependencies.js";
import type { CliDependencies } from "./dependencies.js";
import { ExitCode, handleError } from "./errors/index.js";
import { program } from "./program.js";

export { registerCommands } from "./commands/index.js";
export type { CliDependencies, FileStat, FileSystem, OutputWriter } from "./dependencies.js";
export { ExitCode, handleError } from "./errors/index.js";
export { program } from "./program.js";
export type { AnalysisReport, AnalyzeProjectInput, CommandRunner } from "./services/index.js";
export type { Spinner } from "./ui/index.js";

/** Determines whether this module is running as the process entrypoint, including through npm links. */
export function isCliEntrypoint(
  entryPath: string | undefined,
  modulePath: string,
  resolveRealPath: (path: string) => string,
): boolean {
  if (entryPath === undefined) return false;
  try {
    return resolveRealPath(entryPath) === resolveRealPath(modulePath);
  } catch {
    return false;
  }
}

/** Executes Arcovia with the supplied arguments and returns an exit code. */
export async function run(
  argumentsList: readonly string[],
  dependencies: CliDependencies = createDefaultDependencies(),
): Promise<ExitCode> {
  try {
    await program(dependencies).parseAsync(argumentsList, { from: "node" });
    return ExitCode.Success;
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) {
      return ExitCode.Success;
    }

    return handleError(error, dependencies.standardError, dependencies.configuration.debug);
  }
}

if (isCliEntrypoint(process.argv[1], fileURLToPath(import.meta.url), realpathSync)) {
  void run(process.argv).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
