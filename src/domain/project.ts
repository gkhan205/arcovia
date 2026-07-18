import type { FrameworkType, PackageManager, WorkspaceType } from "./framework.js";
import type { ProjectFile } from "./project-file.js";

/** Summary statistics collected while discovering a project. */
export interface ProjectMetadata {
  readonly directories: number;
  readonly hiddenFiles: number;
  readonly ignoredFiles: number;
  readonly largestFile?: {
    readonly path: string;
    readonly size: number;
  };
  readonly scanDuration: number;
  readonly skippedFiles: number;
  readonly sourceFiles: number;
  readonly totalFiles: number;
  readonly workspacePackages: number;
}

/** A project discovered by Arcovia's scanner. */
export interface Project {
  readonly files: readonly ProjectFile[];
  readonly framework: FrameworkType;
  readonly id: string;
  readonly metadata: ProjectMetadata;
  readonly name: string;
  readonly packageManager: PackageManager;
  readonly root: string;
  readonly workspace: WorkspaceType;
}
