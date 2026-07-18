/** Converts a filesystem path into Arcovia's POSIX-internal representation. */
export function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+/g, "/");
}
