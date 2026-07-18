/** Frontend framework detected for a project. */
export enum FrameworkType {
  Angular = "angular",
  React = "react",
  Next = "next",
  Svelte = "svelte",
  Unknown = "unknown",
  Vite = "vite",
  Vue = "vue",
}

/** Supported project workspace layouts. */
export enum WorkspaceType {
  Nx = "nx",
  Pnpm = "pnpm-workspace",
  SinglePackage = "single-package",
  Turborepo = "turborepo",
  Unknown = "unknown",
}

/** Package manager detected for a project. */
export enum PackageManager {
  Bun = "bun",
  Npm = "npm",
  Pnpm = "pnpm",
  Yarn = "yarn",
  Unknown = "unknown",
}
