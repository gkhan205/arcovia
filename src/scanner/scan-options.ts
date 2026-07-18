/** Options controlling deterministic project discovery. */
export interface ScanOptions {
  readonly followSymlinks?: boolean;
  readonly ignore?: readonly string[];
  readonly includeHidden?: boolean;
  readonly includeStories?: boolean;
  readonly includeTests?: boolean;
  readonly maxFileSizeMB?: number;
  readonly projectPath: string;
}
