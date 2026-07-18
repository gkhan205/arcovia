import type { AnalysisReport } from "./analysis-report.js";
import { DomainValidationError } from "./domain-validation-error.js";

/** Validates the shared invariants required by the canonical analysis artifact. */
export function validateAnalysisReport(report: AnalysisReport): void {
  assertUniqueIds(report.project.files, "project files");
  assertUniqueIds(report.model.components, "components");
  assertUniqueIds(report.model.contexts, "contexts");
  assertUniqueIds(report.model.hooks, "hooks");
  assertUniqueIds(report.model.modules, "modules");
  assertUniqueIds(report.model.routes, "routes");
  assertUniqueIds(report.graph.nodes, "graph nodes");
  assertUniqueIds(report.graph.cycles, "graph cycles");
  assertUniqueIds(report.findings, "findings");

  assertNormalizedPath(report.project.root, "project root");

  for (const file of report.project.files) {
    assertNormalizedPath(file.absolutePath, `absolute path for file ${file.id}`);
    assertNormalizedPath(file.path, `path for file ${file.id}`);
    assertNormalizedPath(file.relativePath, `relative path for file ${file.id}`);
  }
}

/** Returns whether a path uses Arcovia's canonical forward-slash normalization. */
export function isNormalizedPath(path: string): boolean {
  return path.length > 0 && path === path.replaceAll("\\", "/").replace(/\/+/g, "/");
}

function assertNormalizedPath(path: string, name: string): void {
  if (!isNormalizedPath(path)) {
    throw new DomainValidationError(
      `Expected a normalized ${name}.`,
      "DOMAIN_PATH_NOT_NORMALIZED",
      ["Normalize path separators to forward slashes before creating domain objects."],
    );
  }
}

function assertUniqueIds(values: readonly { readonly id: string }[], name: string): void {
  const ids = new Set<string>();

  for (const value of values) {
    if (ids.has(value.id)) {
      throw new DomainValidationError(
        `Duplicate ID found in ${name}: ${value.id}.`,
        "DOMAIN_DUPLICATE_ID",
        ["Assign a stable, unique ID to every domain object in this collection."],
      );
    }

    ids.add(value.id);
  }
}
