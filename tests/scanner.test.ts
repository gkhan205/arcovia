import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FrameworkType, PackageManager, WorkspaceType } from "../src/domain/index.js";
import { normalizePath, ProjectNotFoundError, ProjectScanner } from "../src/scanner/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function createProject(files: Readonly<Record<string, string>>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "arcovia-scanner-"));
  temporaryDirectories.push(directory);

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(directory, relativePath);
    await mkdir(resolve(filePath, ".."), { recursive: true });
    await writeFile(filePath, content);
  }

  return directory;
}

describe("ProjectScanner", () => {
  it("discovers a normalized React project and applies default and file ignore rules", async () => {
    const projectPath = await createProject({
      ".gitignore": "generated/**\n",
      "generated/ignored.ts": "export const ignored = true;",
      "node_modules/package/index.js": "module.exports = {};",
      "package.json": '{"name":"example","dependencies":{"react":"19.0.0"}}',
      "src/.hidden.ts": "export const hidden = true;",
      "src/app.test.ts": "export const test = true;",
      "src/app.ts": "export const app = true;",
      "src/story.stories.tsx": "export const Story = {};",
    });

    const project = await new ProjectScanner().scan({ projectPath });

    expect(project.framework).toBe(FrameworkType.React);
    expect(project.packageManager).toBe(PackageManager.Unknown);
    expect(project.workspace).toBe(WorkspaceType.SinglePackage);
    expect(project.files.map((file) => file.relativePath)).toEqual(["src/app.ts"]);
    expect(project.files[0]?.absolutePath).toBe(normalizePath(join(projectPath, "src/app.ts")));
    expect(project.metadata.ignoredFiles).toBeGreaterThanOrEqual(3);
    expect(project.id).toHaveLength(64);
  });

  it("detects Next.js, pnpm, and a pnpm workspace", async () => {
    const projectPath = await createProject({
      "package.json": '{"name":"workspace","dependencies":{"next":"15.0.0","react":"19.0.0"}}',
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "pnpm-workspace.yaml": "packages:\n  - apps/*\n",
      "src/page.tsx": "export default function Page() { return null; }",
    });

    const project = await new ProjectScanner().scan({ projectPath });

    expect(project.framework).toBe(FrameworkType.Next);
    expect(project.packageManager).toBe(PackageManager.Pnpm);
    expect(project.workspace).toBe(WorkspaceType.Pnpm);
    expect(project.metadata.workspacePackages).toBe(1);
  });

  it("marks files larger than the configured limit as skipped", async () => {
    const projectPath = await createProject({
      "package.json": '{"name":"large-file"}',
      "src/large.ts": "x".repeat(2048),
    });

    const project = await new ProjectScanner().scan({ maxFileSizeMB: 0.001, projectPath });

    expect(project.files[0]?.isSkipped).toBe(true);
    expect(project.files[0]?.skipReason).toBe("FileTooLarge");
    expect(project.metadata.skippedFiles).toBe(1);
  });

  it("does not traverse symlinks unless explicitly enabled", async () => {
    const projectPath = await createProject({
      "package.json": '{"name":"links"}',
      "src/app.ts": "export const app = true;",
    });
    await symlink(join(projectPath, "src"), join(projectPath, "linked-src"));

    const withoutLinks = await new ProjectScanner().scan({ projectPath });
    const withLinks = await new ProjectScanner().scan({ followSymlinks: true, projectPath });

    expect(withoutLinks.files).toHaveLength(1);
    expect(withLinks.files).toHaveLength(1);
  });

  it("throws a typed error when a project root cannot be found", async () => {
    const directory = await createProject({ "empty.txt": "empty" });

    await expect(new ProjectScanner().scan({ projectPath: directory })).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
  });
});
