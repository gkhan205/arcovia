import { describe, expect, it } from "vitest";
import type { AnalysisReport, ProjectFile } from "../src/domain/index.js";
import {
  DomainValidationError,
  FrameworkType,
  PackageManager,
  Severity,
  validateAnalysisReport,
  WorkspaceType,
} from "../src/domain/index.js";

function createProjectFile(path = "src/app.ts"): ProjectFile {
  return {
    absolutePath: `/workspace/${path}`,
    extension: ".ts",
    hash: "hash",
    id: "file-app",
    isIgnored: false,
    isSkipped: false,
    isStory: false,
    isTest: false,
    lastModified: 0,
    path,
    relativePath: path,
    size: 100,
  };
}

function createReport(): AnalysisReport {
  return {
    findings: [
      {
        category: "architecture",
        description: "A dependency cycle was found.",
        evidence: [],
        id: "finding-cycle",
        location: { column: 1, file: "src/app.ts", line: 1 },
        metadata: {},
        recommendation: "Remove the cyclic dependency.",
        rationale: "Cycles make module initialization order harder to reason about.",
        ruleId: "no-cycles",
        severity: Severity.Error,
        title: "Circular dependency",
      },
    ],
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
      duration: 100,
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
      totalFiles: 1,
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
      files: [createProjectFile()],
      framework: FrameworkType.React,
      id: "project-example",
      metadata: {
        directories: 1,
        hiddenFiles: 0,
        ignoredFiles: 0,
        scanDuration: 100,
        skippedFiles: 0,
        sourceFiles: 1,
        totalFiles: 1,
        workspacePackages: 1,
      },
      name: "example",
      packageManager: PackageManager.Pnpm,
      root: "/workspace",
      workspace: WorkspaceType.SinglePackage,
    },
    score: {
      overall: 91,
      grade: "A",
      categories: [],
      breakdown: {
        categoryWeightedScore: 91,
        criticalRiskAdjustment: 0,
        maintenanceBurden: 0,
        contributors: [],
        deductions: [],
        strengths: [],
        summary: "test",
        weaknesses: [],
      },
      metadata: {
        confidence: { reason: "test", value: 100 },
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

describe("AnalysisReport domain model", () => {
  it("round-trips through JSON and retains validation invariants", () => {
    const serialized = JSON.stringify(createReport());
    const restored: AnalysisReport = JSON.parse(serialized) as AnalysisReport;

    expect(() => validateAnalysisReport(restored)).not.toThrow();
    expect(restored.project.files).toHaveLength(1);
    expect(restored.score.overall).toBe(91);
  });

  it("rejects duplicate IDs", () => {
    const report = createReport();
    const duplicate = createProjectFile("src/duplicate.ts");

    const invalidReport: AnalysisReport = {
      ...report,
      project: { ...report.project, files: [...report.project.files, duplicate] },
    };

    expect(() => validateAnalysisReport(invalidReport)).toThrow(DomainValidationError);
  });

  it("rejects non-normalized paths", () => {
    const report = createReport();
    const invalidReport: AnalysisReport = {
      ...report,
      project: { ...report.project, root: "workspace\\example" },
    };

    expect(() => validateAnalysisReport(invalidReport)).toThrow(
      "Expected a normalized project root.",
    );
  });
});
