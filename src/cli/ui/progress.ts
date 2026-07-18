import type { Spinner } from "./spinner.js";

/** Represents CLI progress without coupling commands to a spinner library. */
export class Progress {
  public constructor(private readonly spinner: Spinner) {}

  /** Starts displaying a named task. */
  public start(task: string): void {
    this.spinner.start(task);
  }

  /** Completes the active task. */
  public succeed(task: string): void {
    this.spinner.succeed(task);
  }

  /** Fails the active task. */
  public fail(task: string): void {
    this.spinner.fail(task);
  }
}
