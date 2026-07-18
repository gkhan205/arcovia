/** Raw architecture measurements collected during analysis. */
export interface MetricCollection {
  readonly components: number;
  readonly contexts: number;
  readonly cycles: number;
  readonly dependencies: number;
  readonly exports: number;
  readonly hooks: number;
  readonly imports: number;
  readonly totalFiles: number;
}
