import { posix } from "node:path";

import type { Module } from "../domain/index.js";

/** Resolves Arcovia's supported project-local import spellings to a parsed module. */
export function resolveLocalModule(
  source: string,
  sourcePath: string,
  modules: readonly Module[],
): Module | undefined {
  if (source.startsWith(".")) {
    return modules.find((module) => relativeCandidates(source, sourcePath).includes(module.path));
  }

  if (!source.startsWith("@/")) return undefined;

  const normalizedAlias = `src/${source.slice(2)}`;
  const aliasMatches = modules.filter(
    (module) =>
      stripExtension(module.path) === normalizedAlias ||
      stripExtension(module.path).endsWith(`/${normalizedAlias}`),
  );
  return aliasMatches.length === 1 ? aliasMatches[0] : undefined;
}

function relativeCandidates(source: string, sourcePath: string): readonly string[] {
  const base = posix.normalize(posix.join(posix.dirname(sourcePath), source));
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];
  return [
    base,
    ...extensions.map((extension) => `${base}${extension}`),
    ...extensions.map((extension) => `${base}/index${extension}`),
  ];
}

function stripExtension(path: string): string {
  return path.replace(/\.(?:[cm]?[jt]sx?)$/u, "");
}
