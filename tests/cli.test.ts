import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import type {
  AnalysisReport,
  AnalyzeProjectInput,
  CliDependencies,
  CommandRunner,
  Spinner,
} from "../src/cli/index.js";
import { isCliEntrypoint, run } from "../src/cli/index.js";
import { FrameworkType, PackageManager, WorkspaceType } from "../src/domain/index.js";
import { Logger } from "../src/shared/index.js";

class RecordingSpinner implements Spinner {
  public readonly messages: string[] = [];

  public fail(text: string): void {
    this.messages.push(`fail:${text}`);
  }

  public start(text: string): void {
    this.messages.push(`start:${text}`);
  }

  public succeed(text: string): void {
    this.messages.push(`success:${text}`);
  }
}

function createDependencies(overrides: Partial<CliDependencies> = {}): {
  readonly dependencies: CliDependencies;
  readonly output: string[];
  readonly spinner: RecordingSpinner;
} {
  const output: string[] = [];
  const spinner = new RecordingSpinner();
  const commandRunner: CommandRunner = {
    analyze: async (input) => createReport(input.projectPath),
  };
  const writer = { write: (message: string) => output.push(message) };

  return {
    dependencies: {
      commandRunner,
      configuration: { debug: false },
      createSpinner: () => spinner,
      currentDirectory: () => "/workspace",
      fileSystem: { stat: async () => ({ isDirectory: () => true }) },
      logger: new Logger({ level: "ERROR", writer }),
      standardError: writer,
      standardOutput: writer,
      version: "0.1.0",
      ...overrides,
    },
    output,
    spinner,
  };
}

describe("Arcovia CLI", () => {
  it("recognizes a symlinked executable as the CLI entrypoint", () => {
    const realPaths = new Map([
      ["/usr/local/bin/arcovia", "/workspace/dist/cli.js"],
      ["/workspace/dist/cli.js", "/workspace/dist/cli.js"],
    ]);

    expect(
      isCliEntrypoint("/usr/local/bin/arcovia", "/workspace/dist/cli.js", (path) => {
        const resolved = realPaths.get(path);
        if (resolved === undefined) throw new Error("Missing path.");
        return resolved;
      }),
    ).toBe(true);
  });

  it("delegates analyze options to the Core boundary", async () => {
    const calls: AnalyzeProjectInput[] = [];
    const { dependencies, output, spinner } = createDependencies({
      commandRunner: {
        analyze: async (input) => {
          calls.push(input);
          return createReport(input.projectPath);
        },
      },
    });

    const exitCode = await run(
      [
        "node",
        "arcovia",
        "analyze",
        "apps/web",
        "--html",
        "--json",
        "--verbose",
        "--output",
        "reports",
      ],
      dependencies,
    );

    expect(exitCode).toBe(0);
    expect(calls).toEqual([
      {
        ai: false,
        generateHtml: true,
        generateJson: true,
        generateMarkdown: false,
        outputPath: resolve("/workspace", "reports"),
        projectPath: resolve("/workspace", "apps/web"),
        verbose: true,
      },
    ]);
    expect(spinner.messages).toEqual([
      "start:Validating project path",
      "success:Validated project path",
      "start:Analyzing project",
      "success:Analysis complete",
    ]);
    expect(output).toEqual([`Analysis complete: ${resolve("/workspace", "apps/web")}\n`]);
  });

  it("supports the analyse alias and generates reports by default", async () => {
    const calls: AnalyzeProjectInput[] = [];
    const { dependencies } = createDependencies({
      commandRunner: {
        analyze: async (input) => {
          calls.push(input);
          return createReport(input.projectPath);
        },
      },
    });

    expect(await run(["node", "arcovia", "analyse"], dependencies)).toBe(0);
    expect(calls).toEqual([
      {
        ai: false,
        generateHtml: true,
        generateJson: true,
        generateMarkdown: false,
        outputPath: "/workspace/.arcovia-report",
        projectPath: "/workspace",
        verbose: false,
      },
    ]);
  });

  it("uses Arcovia global quality bands when benchmark is passed without a profile path", async () => {
    const calls: AnalyzeProjectInput[] = [];
    const { dependencies } = createDependencies({
      commandRunner: {
        analyze: async (input) => {
          calls.push(input);
          return createReport(input.projectPath);
        },
      },
    });

    expect(await run(["node", "arcovia", "analyze", "--benchmark"], dependencies)).toBe(0);
    expect(calls[0]?.benchmark).toMatchObject({
      cohort: "Arcovia global quality bands",
      score: { p25: 75, p50: 85, p75: 93 },
    });
  });

  it("reports a missing project without calling Core", async () => {
    const { dependencies, output } = createDependencies({
      fileSystem: {
        stat: async () => {
          throw new Error("ENOENT");
        },
      },
    });

    const exitCode = await run(["node", "arcovia", "analyze", "missing-project"], dependencies);

    expect(exitCode).toBe(4);
    expect(output.join("")).toContain("Project not found: /workspace/missing-project");
    expect(output.join("")).toContain("Run: arcovia analyze ./project");
  });

  it("registers doctor, init, and version commands", async () => {
    for (const [command, expectedOutput] of [
      ["doctor", "Arcovia CLI environment is ready.\n"],
      ["init", "Arcovia does not require project initialization.\n"],
      ["version", "0.1.0\n"],
    ] as const) {
      const { dependencies, output } = createDependencies();

      expect(await run(["node", "arcovia", command], dependencies)).toBe(0);
      expect(output).toEqual([expectedOutput]);
    }
  });

  it("renders help and standard version output", async () => {
    const help = createDependencies();
    const version = createDependencies();

    expect(await run(["node", "arcovia", "--help"], help.dependencies)).toBe(0);
    expect(help.output.join("")).toContain("Usage: arcovia [options] [command]");
    expect(help.output.join("")).toContain("analyze|analyse [options] [project-path]");

    expect(await run(["node", "arcovia", "--version"], version.dependencies)).toBe(0);
    expect(version.output).toEqual(["0.1.0\n"]);
  });
});

function createReport(projectPath: string): AnalysisReport {
  return {
    findings: [],
    generatedAt: "2026-07-18T00:00:00.000Z",
    graph: {
      cycles: [],
      edges: [],
      nodes: [],
      orphans: [],
      statistics: {
        averageFanIn: 0,
        averageFanOut: 0,
        connectedComponents: 0,
        cycles: 0,
        edges: 0,
        maxDepth: 0,
        nodes: 0,
        orphans: 0,
      },
    },
    metadata: {
      arcoviaVersion: "0.1.0",
      duration: 0,
      framework: "react",
      generatedAt: "2026-07-18T00:00:00.000Z",
      nodeVersion: "22.17.1",
      packageManager: "pnpm",
    },
    metrics: {
      components: 0,
      contexts: 0,
      cycles: 0,
      dependencies: 0,
      exports: 0,
      hooks: 0,
      imports: 0,
      totalFiles: 0,
    },
    model: {
      components: [],
      contexts: [],
      exports: [],
      hooks: [],
      imports: [],
      modules: [],
      parseErrors: [],
      routes: [],
      symbols: [],
    },
    project: {
      files: [],
      framework: FrameworkType.React,
      id: "project-example",
      metadata: {
        directories: 1,
        hiddenFiles: 0,
        ignoredFiles: 0,
        scanDuration: 0,
        skippedFiles: 0,
        sourceFiles: 0,
        totalFiles: 0,
        workspacePackages: 1,
      },
      name: "example",
      packageManager: PackageManager.Pnpm,
      root: projectPath,
      workspace: WorkspaceType.SinglePackage,
    },
    score: {
      overall: 0,
      grade: "F",
      categories: [],
      breakdown: {
        categoryWeightedScore: 0,
        criticalRiskAdjustment: 0,
        maintenanceBurden: 0,
        contributors: [],
        deductions: [],
        strengths: [],
        summary: "test",
        weaknesses: [],
      },
      metadata: {
        confidence: { reason: "test", value: 0 },
        criticalFindings: 0,
        duplicateFindingsIgnored: 0,
        errorFindings: 0,
        normalizedFindingCount: 0,
        warningFindings: 0,
      },
    },
    version: "v1",
  };
}
