/** A parsed source module and its referenced symbols. */
export interface Module {
  readonly dependencies: readonly string[];
  readonly exports: readonly string[];
  readonly fileId: string;
  readonly id: string;
  readonly imports: readonly string[];
  readonly functionCount: number;
  readonly lineCount: number;
  readonly path: string;
}
