import type { Command } from "commander";

import type { CliDependencies } from "../dependencies.js";

/** Registers the version command. */
export function register(program: Command, dependencies: CliDependencies): void {
  program
    .command("version")
    .description("Display the Arcovia version")
    .action(() => {
      dependencies.standardOutput.write(`${dependencies.version}\n`);
    });
}
