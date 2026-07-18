import type { Project } from "../domain/index.js";

/** Input consumed by the source parser. */
export interface ParserInput {
  readonly project: Project;
}
