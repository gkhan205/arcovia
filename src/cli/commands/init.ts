import type { Command } from "commander";

import type { CliDependencies } from "../dependencies.js";

/** Registers the init command. */
export function register(program: Command, dependencies: CliDependencies): void {
  program
    .command("init")
    .description("Explain Arcovia project initialization")
    .action(() => {
      dependencies.standardOutput.write("Arcovia does not require project initialization.\n");
    });
}
