import type { Command } from "commander";

import type { CliDependencies } from "../dependencies.js";

/** Registers the doctor command. */
export function register(program: Command, dependencies: CliDependencies): void {
  program
    .command("doctor")
    .description("Check the Arcovia CLI environment")
    .action(() => {
      dependencies.standardOutput.write("Arcovia CLI environment is ready.\n");
    });
}
