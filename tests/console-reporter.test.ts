import { describe, expect, it } from "vitest";

import {
  type AnalysisReport,
  FrameworkType,
  PackageManager,
  Severity,
  WorkspaceType,
} from "../src/domain/index.js";
import { ConsoleReporter } from "../src/reporters/index.js";

function createReport(findingCount = 2): AnalysisReport {
  const severities = [Severity.Warning, Severity.Critical, Severity.Error, Severity.Info];
  return {
    findings: Array.from({ length: findingCount }, (_, index) => ({
      category: "architecture",
      description: `Description ${index}`,
      evidence: [{ metric: "fanOut", value: index + 1 }],
      id: `finding-${index}`,
      location: { column: 1, file: `src/file-${index}.tsx`, line: index + 1 },
      metadata: {},
      rationale: `Rationale ${index}`,
      recommendation: index % 2 === 0 ? "Break the dependency cycle." : "Split this component.",
      ruleId: index % 2 === 0 ? "no-circular-imports" : "large-component",
      severity: severities[index % severities.length] ?? Severity.Info,
      title: `Finding ${index}`,
    })),
    generatedAt: "2026-07-18T10:00:00.000Z",
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
      duration: 3200,
      framework: FrameworkType.React,
      generatedAt: "2026-07-18T10:00:00.000Z",
      nodeVersion: "v22.0.0",
      packageManager: PackageManager.Pnpm,
    },
    metrics: {
      components: 1,
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
      files: [],
      framework: FrameworkType.React,
      id: "sample",
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
      name: "sample-app",
      packageManager: PackageManager.Pnpm,
      root: "/workspace",
      workspace: WorkspaceType.SinglePackage,
    },
    score: {
      breakdown: {
        categoryWeightedScore: 90,
        criticalRiskAdjustment: 10,
        maintenanceBurden: 0,
        contributors: [],
        deductions: [],
        strengths: ["Imports are healthy."],
        summary: "Architecture is healthy.",
        weaknesses: ["Architecture needs attention."],
      },
      categories: [
        { category: "components", penalty: 20, score: 80, weight: 15 },
        { category: "architecture", penalty: 10, score: 90, weight: 30 },
      ],
      grade: "B+",
      metadata: {
        confidence: { reason: "complete", value: 1 },
        criticalFindings: 1,
        duplicateFindingsIgnored: 0,
        errorFindings: 0,
        normalizedFindingCount: findingCount,
        warningFindings: 1,
      },
      overall: 86,
    },
    version: "0.1.0",
  };
}

describe("ConsoleReporter", () => {
  it("renders the compact product summary with priority-ordered top issues", () => {
    const output = new ConsoleReporter().render(createReport(), {
      colors: false,
      unicode: false,
    }).stdout;

    expect(output).toContain("🦉 Arcovia v0.1.0");
    expect(output.indexOf("Project")).toBeLessThan(output.indexOf("Architecture Health"));
    expect(output.indexOf("Architecture Health")).toBeLessThan(output.indexOf("Summary"));
    expect(output.indexOf("Summary")).toBeLessThan(output.indexOf("Top Issues"));
    expect(output).toContain("Name          sample-app");
    expect(output).toContain("Framework     React");
    expect(output.indexOf("Finding 1")).toBeLessThan(output.indexOf("Finding 0"));
    expect(output.includes(`${String.fromCharCode(27)}[`)).toBe(false);
  });

  it("does not label a B-range risk score as healthy", () => {
    const report = createReport();
    const output = new ConsoleReporter().render(
      { ...report, score: { ...report.score, grade: "B", overall: 75 } },
      { colors: false },
    ).stdout;

    expect(output).toContain("Needs Attention");
    expect(output).not.toContain("Healthy Architecture");
  });

  it("supports deterministic compact, JSON, and CI output", () => {
    const reporter = new ConsoleReporter();
    const report = createReport(8);
    const compact = reporter.render(report, {
      colors: false,
      compact: true,
      unicode: false,
    }).stdout;
    const json = reporter.render(report, { json: true }).stdout;
    const ci = reporter.render(report, { ci: true }).stdout;

    expect(compact).toBe("X 8 findings\nScore: 86\nCritical: 2\nWarnings: 2\n");
    expect(JSON.parse(json)).toMatchObject({
      metadata: { schema: "https://schema.arcovia.dev/analysis/v1" },
    });
    expect(ci.includes(`${String.fromCharCode(27)}[`)).toBe(false);
    expect(ci).toContain("Architecture Health");
  });

  it("limits default finding output while preserving performance for large reports", () => {
    const output = new ConsoleReporter().render(createReport(1000), { colors: false }).stdout;

    expect(output.match(/src\/file-/gu)).toHaveLength(3);
    expect(output).toContain("Findings       1000");
  });

  it("sends recoverable parser diagnostics to stderr", () => {
    const report = createReport();
    const output = new ConsoleReporter().render({
      ...report,
      model: {
        ...report.model,
        parseErrors: [
          {
            column: 2,
            fileId: "src/broken.tsx",
            line: 4,
            message: "Unexpected token '<'",
            severity: "error",
          },
        ],
      },
    });

    expect(output.stderr).toBe(
      "Parser Error\nUnable to parse src/broken.tsx:4\nReason: Unexpected token '<'\n",
    );
  });
});
