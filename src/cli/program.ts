import { Command } from "commander";

import { registerCommands } from "./commands/index.js";
import type { CliDependencies } from "./dependencies.js";

/** Creates Arcovia's command program without executing it. */
export function program(dependencies: CliDependencies): Command {
  const cliProgram = new Command()
    .name("arcovia")
    .description("Architecture intelligence for React and Next.js applications")
    .version(dependencies.version)
    .showHelpAfterError()
    .showSuggestionAfterError()
    .exitOverride()
    .configureOutput({
      writeErr: (message) => dependencies.standardError.write(message),
      writeOut: (message) => dependencies.standardOutput.write(message),
    });

  cliProgram.hook("preAction", () => {
    dependencies.logger.debug("Starting Arcovia command.");
  });

  registerCommands(cliProgram, dependencies);
  return cliProgram;
}
