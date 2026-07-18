/** A physical source file discovered in the analyzed project. */
export interface ProjectFile {
  readonly absolutePath: string;
  readonly extension: string;
  readonly hash?: string;
  readonly id: string;
  readonly lastModified: number;
  readonly isIgnored: boolean;
  readonly isSkipped: boolean;
  readonly isStory: boolean;
  readonly isTest: boolean;
  readonly path: string;
  readonly relativePath: string;
  readonly size: number;
  readonly skipReason?: "FileTooLarge";
}
