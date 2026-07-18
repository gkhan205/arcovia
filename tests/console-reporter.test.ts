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
        deductions: [],
        strengths: ["Imports are healthy."],
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
  it("renders sections in the documented order with sorted top findings", () => {
    const output = new ConsoleReporter().render(createReport(), {
      colors: false,
      unicode: false,
    }).stdout;

    expect(output).toContain("CLI 0.1.0 · Engine 0.1.0");
    expect(output.indexOf("Project")).toBeLessThan(output.indexOf("Architecture Score"));
    expect(output.indexOf("Architecture Score")).toBeLessThan(output.indexOf("Summary"));
    expect(output.indexOf("Summary")).toBeLessThan(output.indexOf("Top Findings"));
    expect(output.indexOf("Top Findings")).toBeLessThan(output.indexOf("Category Breakdown"));
    expect(output.indexOf("[CRITICAL]")).toBeLessThan(output.indexOf("[WARNING]"));
    expect(output.indexOf("architecture")).toBeLessThan(output.indexOf("components"));
    expect(output.includes(`${String.fromCharCode(27)}[`)).toBe(false);
  });

  it("supports deterministic compact, verbose, JSON, and CI output", () => {
    const reporter = new ConsoleReporter();
    const report = createReport(8);
    const compact = reporter.render(report, {
      colors: false,
      compact: true,
      unicode: false,
    }).stdout;
    const verbose = reporter.render(report, { colors: false, verbose: true }).stdout;
    const json = reporter.render(report, { json: true }).stdout;
    const ci = reporter.render(report, { ci: true }).stdout;

    expect(compact).toBe("X 8 findings\nScore: 86\nCritical: 2\nWarnings: 2\n");
    expect(verbose.match(/Evidence:/gu)).toHaveLength(8);
    expect(verbose).toContain("Metrics");
    expect(JSON.parse(json)).toMatchObject({
      metadata: { schema: "https://schema.arcovia.dev/analysis/v1" },
    });
    expect(ci.includes(`${String.fromCharCode(27)}[`)).toBe(false);
  });

  it("limits default finding output while preserving performance for large reports", () => {
    const output = new ConsoleReporter().render(createReport(1000), { colors: false }).stdout;

    expect(output.match(/\[.*\]/gu)).toHaveLength(5);
    expect(output).toContain("Total Findings: 1000");
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
