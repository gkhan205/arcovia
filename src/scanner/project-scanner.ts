import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

import {
  FrameworkType,
  PackageManager,
  type Project,
  type ProjectFile,
  type ProjectMetadata,
  WorkspaceType,
} from "../domain/index.js";
import { normalizePath } from "./path-normalizer.js";
import type { ScanOptions } from "./scan-options.js";
import { InvalidPackageJsonError, ProjectNotFoundError } from "./scanner-error.js";

const PROJECT_MARKERS = ["package.json", "pnpm-workspace.yaml", "yarn.lock", "package-lock.json"];
const PACKAGE_MANAGER_FILES: Readonly<Record<PackageManager, string>> = {
  [PackageManager.Bun]: "bun.lockb",
  [PackageManager.Npm]: "package-lock.json",
  [PackageManager.Pnpm]: "pnpm-lock.yaml",
  [PackageManager.Yarn]: "yarn.lock",
  [PackageManager.Unknown]: "",
};
const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "storybook-static",
  "out",
  ".vercel",
  ".cache",
]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]);
const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

interface PackageJson {
  readonly dependencies?: Readonly<Record<string, unknown>>;
  readonly devDependencies?: Readonly<Record<string, unknown>>;
  readonly name?: string;
}

interface ScanCounters {
  directories: number;
  hiddenFiles: number;
  ignoredFiles: number;
  largestFile?: { path: string; size: number };
  skippedFiles: number;
  totalFiles: number;
  workspacePackages: number;
}

/** Optional logger used to report recoverable discovery errors. */
export interface ScannerLogger {
  warn(message: string): void;
}

/** Discovers a project without parsing or executing any source code. */
export class ProjectScanner {
  public constructor(private readonly logger?: ScannerLogger) {}

  /** Scans a project path and returns its normalized domain representation. */
  public async scan(options: ScanOptions): Promise<Project> {
    const startedAt = performance.now();
    const projectRoot = await this.findProjectRoot(options.projectPath);
    const packageJson = await this.readPackageJson(projectRoot);
    const ignorePatterns = await this.loadIgnorePatterns(projectRoot, options.ignore ?? []);
    const counters: ScanCounters = {
      directories: 0,
      hiddenFiles: 0,
      ignoredFiles: 0,
      skippedFiles: 0,
      totalFiles: 0,
      workspacePackages: 0,
    };
    const files = await this.discoverFiles(projectRoot, options, ignorePatterns, counters);
    const workspace = await this.detectWorkspace(projectRoot);

    return {
      files,
      framework: detectFramework(packageJson),
      id: createId(normalizePath(projectRoot)),
      metadata: createMetadata(counters, files.length, performance.now() - startedAt),
      name: packageJson?.name ?? basename(projectRoot),
      packageManager: await this.detectPackageManager(projectRoot),
      root: normalizePath(projectRoot),
      workspace,
    };
  }

  private async findProjectRoot(projectPath: string): Promise<string> {
    const initialPath = resolve(projectPath);

    try {
      if (!(await stat(initialPath)).isDirectory()) {
        throw new ProjectNotFoundError(projectPath);
      }
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        throw error;
      }

      throw new ProjectNotFoundError(projectPath);
    }

    let candidate = initialPath;
    while (true) {
      if (await containsProjectMarker(candidate)) {
        return candidate;
      }

      const parent = dirname(candidate);
      if (parent === candidate) {
        throw new ProjectNotFoundError(projectPath);
      }

      candidate = parent;
    }
  }

  private async readPackageJson(projectRoot: string): Promise<PackageJson | undefined> {
    const packagePath = join(projectRoot, "package.json");
    const content = await readOptionalFile(packagePath);
    if (content === undefined) {
      return undefined;
    }

    try {
      const parsed: unknown = JSON.parse(content);
      if (!isRecord(parsed)) {
        throw new InvalidPackageJsonError(packagePath);
      }

      return {
        ...(typeof parsed.name === "string" ? { name: parsed.name } : {}),
        ...(isRecord(parsed.dependencies) ? { dependencies: parsed.dependencies } : {}),
        ...(isRecord(parsed.devDependencies) ? { devDependencies: parsed.devDependencies } : {}),
      };
    } catch (error) {
      if (error instanceof InvalidPackageJsonError) {
        throw error;
      }

      throw new InvalidPackageJsonError(packagePath);
    }
  }

  private async loadIgnorePatterns(
    projectRoot: string,
    commandPatterns: readonly string[],
  ): Promise<readonly string[]> {
    const arcoviaIgnore = await readOptionalFile(join(projectRoot, ".arcoviaignore"));
    const gitIgnore = await readOptionalFile(join(projectRoot, ".gitignore"));

    return [...commandPatterns, ...parseIgnoreFile(arcoviaIgnore), ...parseIgnoreFile(gitIgnore)];
  }

  private async discoverFiles(
    projectRoot: string,
    options: ScanOptions,
    ignorePatterns: readonly string[],
    counters: ScanCounters,
  ): Promise<readonly ProjectFile[]> {
    const stack = [projectRoot];
    const visitedDirectories = new Set<string>();
    const files: ProjectFile[] = [];
    const maxFileSize =
      options.maxFileSizeMB === undefined
        ? DEFAULT_MAX_FILE_SIZE_BYTES
        : options.maxFileSizeMB * 1024 * 1024;

    while (stack.length > 0) {
      const directory = stack.pop();
      if (directory === undefined) {
        continue;
      }

      if (
        options.followSymlinks &&
        !(await this.markDirectoryVisited(directory, visitedDirectories))
      ) {
        continue;
      }

      let entries: Dirent<string>[];
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch {
        this.logger?.warn(`Skipping unreadable directory: ${normalizePath(directory)}`);
        continue;
      }

      counters.directories += 1;
      entries.sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        const absolutePath = join(directory, entry.name);
        const relativePath = normalizePath(relative(projectRoot, absolutePath));
        const isHidden = entry.name.startsWith(".");

        if (isHidden && !isAllowedHiddenFile(entry.name)) {
          counters.hiddenFiles += 1;
          if (!options.includeHidden) {
            continue;
          }
        }

        if (entry.isSymbolicLink()) {
          await this.handleSymlink(absolutePath, stack, options, visitedDirectories);
          continue;
        }

        if (entry.isDirectory()) {
          if (!shouldIgnoreDirectory(entry.name, relativePath, ignorePatterns)) {
            stack.push(absolutePath);
          }
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        counters.totalFiles += 1;
        if (entry.name === "package.json") {
          counters.workspacePackages += 1;
        }
        const extension = extname(entry.name).toLowerCase();
        if (!SOURCE_EXTENSIONS.has(extension) || shouldIgnoreFile(relativePath, ignorePatterns)) {
          counters.ignoredFiles += 1;
          continue;
        }

        const isTest = isTestFile(entry.name);
        const isStory = isStoryFile(entry.name);
        if ((isTest && !options.includeTests) || (isStory && !options.includeStories)) {
          counters.ignoredFiles += 1;
          continue;
        }

        let fileStats: Awaited<ReturnType<typeof stat>>;
        try {
          fileStats = await stat(absolutePath);
        } catch {
          this.logger?.warn(`Skipping unreadable file: ${normalizePath(absolutePath)}`);
          continue;
        }
        updateLargestFile(counters, relativePath, fileStats.size);
        const isSkipped = fileStats.size > maxFileSize;
        if (isSkipped) {
          counters.skippedFiles += 1;
        }

        files.push({
          absolutePath: normalizePath(absolutePath),
          extension,
          id: createId(relativePath),
          isIgnored: false,
          isSkipped,
          isStory,
          isTest,
          lastModified: fileStats.mtimeMs,
          path: relativePath,
          relativePath,
          size: fileStats.size,
          ...(isSkipped ? { skipReason: "FileTooLarge" } : {}),
        });
      }
    }

    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  }

  private async handleSymlink(
    path: string,
    stack: string[],
    options: ScanOptions,
    visitedDirectories: Set<string>,
  ): Promise<void> {
    if (!options.followSymlinks) {
      return;
    }

    try {
      const resolvedPath = await realpath(path);
      const linkedStats = await stat(resolvedPath);
      if (linkedStats.isDirectory() && visitedDirectories.has(resolvedPath)) {
        return;
      }

      if (linkedStats.isDirectory()) {
        stack.push(resolvedPath);
      }
    } catch {
      this.logger?.warn(`Skipping broken symlink: ${normalizePath(path)}`);
    }
  }

  private async markDirectoryVisited(
    path: string,
    visitedDirectories: Set<string>,
  ): Promise<boolean> {
    try {
      const canonicalPath = await realpath(path);
      if (visitedDirectories.has(canonicalPath)) {
        return false;
      }

      visitedDirectories.add(canonicalPath);
      return true;
    } catch {
      return false;
    }
  }

  private async detectPackageManager(projectRoot: string): Promise<PackageManager> {
    for (const manager of [
      PackageManager.Pnpm,
      PackageManager.Npm,
      PackageManager.Yarn,
      PackageManager.Bun,
    ]) {
      if (await fileExists(join(projectRoot, PACKAGE_MANAGER_FILES[manager]))) {
        return manager;
      }
    }

    return PackageManager.Unknown;
  }

  private async detectWorkspace(projectRoot: string): Promise<WorkspaceType> {
    if (await fileExists(join(projectRoot, "turbo.json"))) {
      return WorkspaceType.Turborepo;
    }

    if (await fileExists(join(projectRoot, "nx.json"))) {
      return WorkspaceType.Nx;
    }

    if (await fileExists(join(projectRoot, "pnpm-workspace.yaml"))) {
      return WorkspaceType.Pnpm;
    }

    return WorkspaceType.SinglePackage;
  }
}

function createId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createMetadata(
  counters: ScanCounters,
  sourceFiles: number,
  duration: number,
): ProjectMetadata {
  return {
    directories: counters.directories,
    hiddenFiles: counters.hiddenFiles,
    ignoredFiles: counters.ignoredFiles,
    ...(counters.largestFile === undefined ? {} : { largestFile: counters.largestFile }),
    scanDuration: duration,
    skippedFiles: counters.skippedFiles,
    sourceFiles,
    totalFiles: counters.totalFiles,
    workspacePackages: counters.workspacePackages,
  };
}

function detectFramework(packageJson: PackageJson | undefined): FrameworkType {
  const dependencies = { ...packageJson?.dependencies, ...packageJson?.devDependencies };
  if ("next" in dependencies) return FrameworkType.Next;
  if ("react" in dependencies) return FrameworkType.React;
  if ("vite" in dependencies) return FrameworkType.Vite;
  if ("@angular/core" in dependencies) return FrameworkType.Angular;
  if ("vue" in dependencies) return FrameworkType.Vue;
  if ("svelte" in dependencies) return FrameworkType.Svelte;
  return FrameworkType.Unknown;
}

function isAllowedHiddenFile(name: string): boolean {
  return name === ".arcoviaignore" || name === ".gitignore";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoryFile(name: string): boolean {
  return /\.stories\.[^.]+$/u.test(name);
}

function isTestFile(name: string): boolean {
  return /\.(test|spec)\.[^.]+$/u.test(name);
}

function parseIgnoreFile(content: string | undefined): readonly string[] {
  if (content === undefined) {
    return [];
  }

  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("!"));
}

function shouldIgnoreDirectory(
  name: string,
  relativePath: string,
  patterns: readonly string[],
): boolean {
  return IGNORED_DIRECTORIES.has(name) || matchesIgnorePattern(relativePath, patterns);
}

function shouldIgnoreFile(relativePath: string, patterns: readonly string[]): boolean {
  return relativePath.endsWith(".d.ts") || matchesIgnorePattern(relativePath, patterns);
}

function matchesIgnorePattern(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(path));
}

function globToRegExp(pattern: string): RegExp {
  const normalized = normalizePath(pattern).replace(/^\//u, "");
  const escaped = normalized
    .replace(/[|\\{}()[\]^$+?.]/gu, "\\$&")
    .replaceAll("**", "§§")
    .replaceAll("*", "[^/]*")
    .replaceAll("§§", ".*");

  return new RegExp(`(^|.*/)${escaped}$`, "u");
}

async function containsProjectMarker(directory: string): Promise<boolean> {
  for (const marker of PROJECT_MARKERS) {
    if (await fileExists(join(directory, marker))) {
      return true;
    }
  }

  return false;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return undefined;
    }

    throw error;
  }
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return isRecord(error) && error.code === "ENOENT";
}

function updateLargestFile(counters: ScanCounters, path: string, size: number): void {
  if (counters.largestFile === undefined || size > counters.largestFile.size) {
    counters.largestFile = { path, size };
  }
}
