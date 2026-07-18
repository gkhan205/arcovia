import type { Command } from "commander";

import type { CliDependencies } from "../dependencies.js";
import { register as registerAnalyze } from "./analyze.js";
import { register as registerDoctor } from "./doctor.js";
import { register as registerInit } from "./init.js";
import { register as registerVersion } from "./version.js";

/** Registers every supported Arcovia command. */
export function registerCommands(program: Command, dependencies: CliDependencies): void {
  registerAnalyze(program, dependencies);
  registerDoctor(program, dependencies);
  registerInit(program, dependencies);
  registerVersion(program, dependencies);
}
