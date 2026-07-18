import type { Configuration } from "../config/index.js";
import type { Logger } from "../shared/index.js";

import type { CommandRunner } from "./services/index.js";
import type { Spinner } from "./ui/index.js";

/** Async filesystem information needed by CLI path validation. */
export interface FileSystem {
  stat(path: string): Promise<FileStat>;
}

/** Filesystem metadata consumed by the CLI. */
export interface FileStat {
  isDirectory(): boolean;
}

/** Destination used for normal CLI output. */
export interface OutputWriter {
  write(message: string): void;
}

/** Dependencies required to construct Arcovia's CLI program. */
export interface CliDependencies {
  readonly commandRunner: CommandRunner;
  readonly configuration: Configuration;
  readonly createSpinner: () => Spinner;
  readonly currentDirectory: () => string;
  readonly fileSystem: FileSystem;
  readonly logger: Logger;
  /** Opens a completed HTML report in the system's default browser. */
  readonly openReport?: (url: string) => Promise<void>;
  readonly standardError: OutputWriter;
  readonly standardOutput: OutputWriter;
  readonly version: string;
}
