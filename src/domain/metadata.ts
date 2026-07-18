/** Metadata about a completed Arcovia analysis. */
export interface Metadata {
  readonly arcoviaVersion: string;
  readonly duration: number;
  readonly framework: string;
  readonly generatedAt: string;
  readonly nodeVersion: string;
  readonly packageManager: string;
}
