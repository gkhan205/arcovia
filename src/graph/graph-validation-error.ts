import { ArcoviaError } from "../errors/index.js";

/** Indicates an invalid internal graph structure. */
export class GraphValidationError extends ArcoviaError {
  public constructor(message: string) {
    super(message, "GRAPH_VALIDATION_ERROR", [
      "Ensure graph edge IDs reference existing unique graph nodes.",
    ]);
  }
}
