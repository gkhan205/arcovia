import { ArcoviaError } from "./arcovia-error.js";

/** Indicates that Arcovia configuration cannot be used safely. */
export class ConfigurationError extends ArcoviaError {
  public constructor(message: string, suggestions: readonly string[]) {
    super(message, "CONFIGURATION_ERROR", suggestions);
  }
}
