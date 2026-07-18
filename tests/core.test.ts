import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  AnalysisAbortedError,
  AnalysisBuilder,
  CoreEngine,
  ReporterPipeline,
} from "../src/core/index.js";
import {
  type ArchitectureGraph,
  type ArchitectureScore,
  FrameworkType,
  PackageManager,
  type Project,
  type ProjectModel,
  WorkspaceType,
} from "../src/domain/index.js";

const project: Project = {
  files: [],
  framework: FrameworkType.React,
  id: "project",
  metadata: {
    directories: 1,
    hiddenFiles: 0,
    ignoredFiles: 0,
    scanDuration: 1,
    skippedFiles: 0,
    sourceFiles: 1,
    totalFiles: 1,
    workspacePackages: 1,
  },
  name: "fixture",
  packageManager: PackageManager.Pnpm,
  root: "/fixture",
  workspace: WorkspaceType.SinglePackage,
};
const model: ProjectModel = {
  components: [],
  contexts: [],
  exports: [],
  hooks: [],
  imports: [],
  modules: [],
  parseErrors: [],
  routes: [],
  symbols: [],
};
const graph: ArchitectureGraph = {
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
};
const score: ArchitectureScore = {
  breakdown: { deductions: [], strengths: [], weaknesses: [] },
  categories: [],
  grade: "A+",
  metadata: {
    confidence: { reason: "complete", value: 1 },
    criticalFindings: 0,
    duplicateFindingsIgnored: 0,
    errorFindings: 0,
    normalizedFindingCount: 0,
    warningFindings: 0,
  },
  overall: 100,
};

describe("CoreEngine", () => {
  it("orchestrates stages, returns a canonical report, and emits progress", async () => {
    const calls: string[] = [];
    const progress: string[] = [];
    const engine = new CoreEngine({
      analysisBuilder: new AnalysisBuilder({
        clock: () => new Date("2026-01-01T00:00:00.000Z"),
        version: "1.0.0",
      }),
      graphBuilder: {
        build: () => {
          calls.push("graph");
          return graph;
        },
      },
      parser: {
        parse: () => {
          calls.push("parse");
          return model;
        },
      },
      ruleConfiguration: { rules: {} },
      ruleEngine: {
        execute: async () => {
          calls.push("rules");
          return [];
        },
      },
      scanner: {
        scan: async () => {
          calls.push("scan");
          return project;
        },
      },
      scoreEngine: {
        calculate: () => {
          calls.push("score");
          return score;
        },
      },
    });

    const result = await engine.analyze({
      onProgress: (event) => progress.push(event.stage),
      projectPath: "/fixture",
    });

    expect(calls).toEqual(["scan", "parse", "graph", "rules", "score"]);
    expect(progress).toEqual(["scan", "parse", "graph", "rules", "score", "report"]);
    expect(result.report.project).toBe(project);
    expect(result.report.metrics.totalFiles).toBe(1);
    expect(result.statistics).toEqual({
      components: 0,
      findings: 0,
      modules: 0,
      nodes: 0,
      sourceFiles: 1,
    });
    expect(result.timings.total).toBeGreaterThanOrEqual(0);
  });

  it("does not start work after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const engine = new CoreEngine({
      analysisBuilder: new AnalysisBuilder({ version: "1.0.0" }),
      graphBuilder: { build: () => graph },
      parser: { parse: () => model },
      ruleConfiguration: { rules: {} },
      ruleEngine: { execute: async () => [] },
      scanner: { scan: async () => project },
      scoreEngine: { calculate: () => score },
    });

    await expect(
      engine.analyze({ projectPath: "/fixture", signal: controller.signal }),
    ).rejects.toBeInstanceOf(AnalysisAbortedError);
  });
});

describe("ReporterPipeline", () => {
  it("runs requested independent reporters and routes console streams", async () => {
    const calls: string[] = [];
    const output: string[] = [];
    const report = new AnalysisBuilder({ version: "1.0.0" }).build({
      findings: [],
      graph,
      model,
      project,
      score,
      timings: { builder: 0, graph: 0, parse: 0, rules: 0, scan: 0, score: 0, total: 1 },
    });
    const pipeline = new ReporterPipeline({
      consoleReporter: { render: () => ({ stderr: "diagnostic\n", stdout: "console\n" }) },
      htmlReporter: {
        write: async (path) => {
          calls.push(`html:${path}`);
        },
      },
      jsonReporter: {
        write: async (path) => {
          calls.push(`json:${path}`);
        },
      },
      output: {
        writeError: (message) => output.push(`err:${message}`),
        writeOutput: (message) => output.push(`out:${message}`),
      },
    });

    await pipeline.execute(report, { html: true, json: true, outputDirectory: "reports" });

    expect(calls).toEqual([
      `json:${resolve("reports/analysis.json")}`,
      `html:${resolve("reports/report.html")}`,
    ]);
    expect(output).toEqual([
      "out:console\n",
      "err:diagnostic\n",
      `out:Open HTML report: ${pathToFileURL(resolve("reports/report.html")).href}\n`,
    ]);
  });

  it("archives the previous latest report artifacts before writing a new analysis", async () => {
    const directory = await mkdtemp(join(tmpdir(), "arcovia-report-history-"));
    const report = new AnalysisBuilder({ version: "1.0.0" }).build({
      findings: [],
      graph,
      model,
      project,
      score,
      timings: { builder: 0, graph: 0, parse: 0, rules: 0, scan: 0, score: 0, total: 1 },
    });
    await writeFile(join(directory, "analysis.json"), "previous json");
    await writeFile(join(directory, "report.html"), "previous html");
    const pipeline = new ReporterPipeline({
      consoleReporter: { render: () => ({ stderr: "", stdout: "" }) },
      htmlReporter: { write: async (path) => writeFile(path, "current html") },
      jsonReporter: { write: async (path) => writeFile(path, "current json") },
      now: () => new Date("2026-07-18T10:30:45.123Z"),
      output: { writeError: () => undefined, writeOutput: () => undefined },
    });

    try {
      await pipeline.execute(report, { html: true, json: true, outputDirectory: directory });

      expect(await readFile(join(directory, "analysis.json"), "utf8")).toBe("current json");
      expect(await readFile(join(directory, "report.html"), "utf8")).toBe("current html");
      expect(
        await readFile(join(directory, "analysis-2026-07-18T10-30-45-123Z.json"), "utf8"),
      ).toBe("previous json");
      expect(await readFile(join(directory, "report-2026-07-18T10-30-45-123Z.html"), "utf8")).toBe(
        "previous html",
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
