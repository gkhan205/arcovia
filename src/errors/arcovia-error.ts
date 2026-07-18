/** Structured base error for all Arcovia public APIs. */
export abstract class ArcoviaError extends Error {
  public readonly suggestions: readonly string[];

  protected constructor(
    message: string,
    public readonly errorCode: string,
    suggestions: readonly string[],
  ) {
    super(message);
    this.name = new.target.name;
    this.suggestions = suggestions;
  }
}
