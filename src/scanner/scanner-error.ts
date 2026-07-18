import { ArcoviaError } from "../errors/index.js";

/** Base error raised by project discovery. */
export abstract class ScannerError extends ArcoviaError {}

/** Indicates that no discoverable project root was found. */
export class ProjectNotFoundError extends ScannerError {
  public constructor(projectPath: string) {
    super(`Arcovia could not find a project root for: ${projectPath}`, "PROJECT_NOT_FOUND", [
      "Run Arcovia from a directory containing package.json or a package-manager workspace file.",
    ]);
  }
}

/** Indicates that a package manifest could not be parsed safely. */
export class InvalidPackageJsonError extends ScannerError {
  public constructor(packagePath: string) {
    super(`Could not parse package.json: ${packagePath}`, "INVALID_PACKAGE_JSON", [
      "Fix the JSON syntax in package.json and run Arcovia again.",
    ]);
  }
}
