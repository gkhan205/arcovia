/** Log levels supported by Arcovia. */
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

/** Destination used by the logger. */
export interface LogWriter {
  write(message: string): void;
}

/** Options used to create a logger instance. */
export interface LoggerOptions {
  readonly level: LogLevel;
  readonly writer?: LogWriter;
}

const LOG_LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

/** Provides deterministic, structured terminal logging for Arcovia. */
export class Logger {
  private readonly writer: LogWriter;

  public constructor(private readonly options: LoggerOptions) {
    this.writer = options.writer ?? process.stderr;
  }

  /** Writes a debug message when debug logging is enabled. */
  public debug(message: string): void {
    this.log("DEBUG", message);
  }

  /** Writes an informational message. */
  public info(message: string): void {
    this.log("INFO", message);
  }

  /** Writes a warning message. */
  public warn(message: string): void {
    this.log("WARN", message);
  }

  /** Writes an error message. */
  public error(message: string): void {
    this.log("ERROR", message);
  }

  private log(level: LogLevel, message: string): void {
    if (LOG_LEVEL_WEIGHT[level] < LOG_LEVEL_WEIGHT[this.options.level]) {
      return;
    }

    this.writer.write(`[${level}] ${message}\n`);
  }
}
