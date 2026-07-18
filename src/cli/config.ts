import type { Configuration } from "../config/index.js";

/** CLI settings that can be supplied alongside the shared Arcovia configuration. */
export interface CliConfiguration extends Configuration {
  readonly verbose: boolean;
}

/** Resolves CLI settings from command options and shared configuration. */
export function createCliConfiguration(
  configuration: Configuration,
  options: { readonly verbose?: boolean },
): CliConfiguration {
  return {
    ...configuration,
    verbose: options.verbose ?? false,
  };
}
