/** Runtime configuration resolved from supported environment variables. */
export interface Configuration {
  readonly debug: boolean;
}

/** Environment values required to resolve Arcovia configuration. */
export interface Environment {
  readonly ARCOVIA_DEBUG?: string;
}

/**
 * Resolves supported environment variables into a typed configuration object.
 * Environment access is deliberately isolated in this module.
 */
export function createConfiguration(environment: Environment): Configuration {
  return {
    debug: environment.ARCOVIA_DEBUG?.toLowerCase() === "true",
  };
}

/** Loads Arcovia configuration from the process environment. */
export function loadConfiguration(): Configuration {
  return createConfiguration(process.env);
}
