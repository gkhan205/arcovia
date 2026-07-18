import { ArcoviaError } from "../../errors/index.js";

/** Exit codes used by Arcovia's command-line interface. */
export enum ExitCode {
  Success = 0,
  GeneralFailure = 1,
  InvalidArguments = 2,
  ConfigurationError = 3,
  ProjectNotFound = 4,
  UnsupportedFramework = 5,
  ParserError = 6,
  InternalError = 99,
}

/** An actionable error that can be rendered safely in the terminal. */
export class CliError extends ArcoviaError {
  public constructor(
    message: string,
    public readonly exitCode: ExitCode,
    suggestions: readonly string[],
    errorCode = "CLI_ERROR",
  ) {
    super(message, errorCode, suggestions);
  }
}
