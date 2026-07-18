/** A dependency relationship extracted from a module. */
export interface Dependency {
  readonly source: string;
  readonly target: string;
  readonly type: "relative" | "package" | "dynamic";
}

/** An import declaration extracted from a source module. */
export interface ImportStatement {
  readonly fileId: string;
  readonly isDynamic: boolean;
  readonly isTypeOnly: boolean;
  readonly line: number;
  readonly source: string;
  readonly specifiers: readonly string[];
  readonly type: "relative" | "package" | "dynamic";
}

/** An exported symbol extracted from a source module. */
export interface ExportStatement {
  readonly fileId: string;
  readonly isAnonymous: boolean;
  readonly isDefault: boolean;
  readonly isTypeOnly: boolean;
  readonly line: number;
  readonly name: string;
  readonly source?: string;
}
