import type { Ora } from "ora";
import ora from "ora";

/** Minimal spinner interface used by CLI commands. */
export interface Spinner {
  fail(text: string): void;
  start(text: string): void;
  succeed(text: string): void;
}

/** Ora-backed non-blocking terminal spinner. */
export class OraSpinner implements Spinner {
  private readonly spinner: Ora;

  public constructor() {
    this.spinner = ora();
  }

  /** Marks the active task as failed. */
  public fail(text: string): void {
    this.spinner.fail(text);
  }

  /** Starts a new task. */
  public start(text: string): void {
    this.spinner.start(text);
  }

  /** Marks the active task as complete. */
  public succeed(text: string): void {
    this.spinner.succeed(text);
  }
}
