/** A framework-independent component declared in a source file. */
export interface Component {
  readonly exports: readonly string[];
  readonly fileId: string;
  readonly hooks: readonly string[];
  readonly id: string;
  readonly jsxDepth: number;
  readonly lineCount: number;
  readonly name: string;
  readonly props: readonly string[];
  readonly type: "function" | "class" | "arrow";
}
