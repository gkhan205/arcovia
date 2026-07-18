/** Indicates that a domain object violates Arcovia's serialization invariants. */
export class DomainValidationError extends Error {
  public readonly suggestions: readonly string[];

  public constructor(
    message: string,
    public readonly errorCode: string,
    suggestions: readonly string[],
  ) {
    super(message);
    this.name = new.target.name;
    this.suggestions = suggestions;
  }
}
