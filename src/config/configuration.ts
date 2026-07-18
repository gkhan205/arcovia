/** Runtime configuration resolved from supported environment variables. */
export interface Configuration {
  readonly debug: boolean;
  readonly openAiApiKey?: string;
}

/** Environment values required to resolve Arcovia configuration. */
export interface Environment {
  readonly ARCOVIA_DEBUG?: string;
  readonly OPENAI_API_KEY?: string;
}

/**
 * Resolves supported environment variables into a typed configuration object.
 * Environment access is deliberately isolated in this module.
 */
export function createConfiguration(environment: Environment): Configuration {
  const openAiApiKey = environment.OPENAI_API_KEY?.trim();

  return {
    debug: environment.ARCOVIA_DEBUG?.toLowerCase() === "true",
    ...(openAiApiKey === undefined || openAiApiKey.length === 0 ? {} : { openAiApiKey }),
  };
}

/** Loads Arcovia configuration from the process environment. */
export function loadConfiguration(): Configuration {
  return createConfiguration(process.env);
}
