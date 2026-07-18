import { CommanderError } from "commander";

import { ArcoviaError } from "../../errors/index.js";

import { CliError, ExitCode } from "./cli-error.js";

/** Output destination used for command errors. */
export interface ErrorWriter {
  write(message: string): void;
}

/** Renders errors without exposing implementation details by default. */
export function handleError(error: unknown, writer: ErrorWriter, debug: boolean): ExitCode {
  const cliError = toCliError(error);
  writer.write(`${cliError.message}\n`);

  if (cliError.suggestions.length > 0) {
    writer.write(`\n${cliError.suggestions.join("\n")}\n`);
  }

  if (debug && error instanceof Error && error.stack !== undefined) {
    writer.write(`\n${error.stack}\n`);
  }

  return cliError.exitCode;
}

function toCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof ArcoviaError) {
    return new CliError(error.message, ExitCode.GeneralFailure, error.suggestions, error.errorCode);
  }

  if (error instanceof CommanderError) {
    return new CliError(error.message, ExitCode.InvalidArguments, []);
  }

  if (error instanceof Error) {
    return new CliError(error.message, ExitCode.InternalError, []);
  }

  return new CliError("Arcovia encountered an unexpected error.", ExitCode.InternalError, []);
}
