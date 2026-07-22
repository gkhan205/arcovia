import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  type AnalysisReport,
  EdgeType,
  FrameworkType,
  NodeType,
  PackageManager,
  Severity,
  WorkspaceType,
} from "../src/domain/index.js";
import { isBuiltReportModulePath } from "../src/reporters/html/html-reporter.js";
import {
  ANALYSIS_JSON_SCHEMA_URL,
  ANALYSIS_JSON_VERSION,
  createAnalysisJson,
  HtmlReporter,
  parseAnalysisBenchmarkProfile,
  serializeAnalysisJson,
  validateAnalysisJson,
  writeAnalysisJson,
} from "../src/reporters/index.js";

const options = {
  cliVersion: "0.1.0",
  engineVersion: "0.1.0",
  nodeVersion: "v22.0.0",
  os: "Darwin",
  platform: "darwin",
};

describe("HTML report runtime assets", () => {
  it("recognizes a compiled report module on Windows", () => {
    expect(
      isBuiltReportModulePath(
        "C:\\Users\\HP\\AppData\\Local\\npm-cache_npx\\abc\\node_modules\\arcovia\\dist\\chunk.js",
      ),
    ).toBe(true);
  });
});

function createReport(): AnalysisReport {
  return {
    findings: [
      {
        category: "components",
        description: "A component is too large.",
        evidence: [{ metric: "lineCount", value: 200 }],
        id: "warning-finding",
        location: { column: 2, file: "/workspace/src/Widget.tsx", line: 8 },
        metadata: { apiToken: "do-not-export", size: 200 },
        rationale: "Large components are harder to maintain.",
        recommendation: "Split this component.",
        ruleId: "large-component",
        severity: Severity.Warning,
        title: "Large component",
      },
      {
        category: "architecture",
        description: "A circular dependency exists.",
        evidence: [],
        id: "critical-finding",
        location: { column: 1, file: "/workspace/src/App.tsx", line: 3 },
        metadata: {},
        rationale: "Cycles hide dependency direction.",
        recommendation: "Break the cycle.",
        ruleId: "no-circular-imports",
        severity: Severity.Critical,
        title: "Circular import",
      },
    ],
    generatedAt: "2026-07-18T10:00:00.000Z",
    graph: {
      cycles: [],
      edges: [
        {
          id: "edge-widget-app",
          isBroken: false,
          isDynamic: false,
          isExternal: false,
          source: "widget",
          target: "app",
          type: EdgeType.Import,
        },
      ],
      nodes: [
        {
          id: "widget",
          label: "Widget",
          metadata: { source: "private" },
          path: "/workspace/src/Widget.tsx",
          type: NodeType.Component,
        },
        { id: "react", label: "react", metadata: {}, path: "react", type: NodeType.Package },
        {
          id: "app",
          label: "App",
          metadata: {},
          path: "/workspace/src/App.tsx",
          type: NodeType.Component,
        },
      ],
      orphans: [],
      statistics: {
        averageFanIn: 0,
        averageFanOut: 0,
        connectedComponents: 1,
        cycles: 0,
        edges: 1,
        maxDepth: 1,
        nodes: 3,
        orphans: 0,
      },
    },
    metadata: {
      arcoviaVersion: "0.1.0",
      duration: 12,
      framework: FrameworkType.React,
      generatedAt: "2026-07-18T10:00:00.000Z",
      nodeVersion: "v22.0.0",
      packageManager: PackageManager.Pnpm,
    },
    metrics: {
      components: 2,
      contexts: 0,
      cycles: 0,
      dependencies: 1,
      exports: 1,
      hooks: 1,
      imports: 1,
      totalFiles: 2,
    },
    model: {
      components: [],
      contexts: [],
      exports: [
        {
          fileId: "app",
          isAnonymous: false,
          isDefault: false,
          isTypeOnly: false,
          line: 1,
          name: "App",
        },
      ],
      hooks: [],
      imports: [
        {
          fileId: "app",
          isDynamic: false,
          isTypeOnly: false,
          line: 1,
          source: "./Widget",
          specifiers: ["Widget"],
          type: "relative",
        },
      ],
      modules: [
        {
          dependencies: [],
          exports: [],
          fileId: "app",
          functionCount: 1,
          id: "app",
          imports: [],
          lineCount: 30,
          path: "src/App.tsx",
        },
        {
          dependencies: [],
          exports: [],
          fileId: "widget",
          functionCount: 1,
          id: "widget",
          imports: [],
          lineCount: 40,
          path: "src/Widget.tsx",
        },
      ],
      parseErrors: [],
      routes: [],
      symbols: [],
    },
    project: {
      files: [],
      framework: FrameworkType.React,
      id: "project-id",
      metadata: {
        directories: 1,
        hiddenFiles: 0,
        ignoredFiles: 0,
        scanDuration: 1,
        skippedFiles: 0,
        sourceFiles: 2,
        totalFiles: 2,
        workspacePackages: 1,
      },
      name: "sample",
      packageManager: PackageManager.Pnpm,
      root: "/workspace",
      workspace: WorkspaceType.SinglePackage,
    },
    score: {
      breakdown: {
        categoryWeightedScore: 80,
        criticalRiskAdjustment: 0,
        maintenanceBurden: 0,
        contributors: [],
        deductions: [],
        strengths: ["Small dependency graph"],
        summary: "Circular import is the highest-priority risk.",
        weaknesses: ["Circular import"],
      },
      categories: [],
      grade: "B",
      metadata: {
        confidence: { reason: "complete", value: 1 },
        criticalFindings: 1,
        duplicateFindingsIgnored: 0,
        errorFindings: 0,
        normalizedFindingCount: 2,
        warningFindings: 1,
      },
      overall: 80,
    },
    version: "0.1.0",
  };
}

describe("Analysis JSON", () => {
  it("serializes a deterministic, sanitized v1 artifact", () => {
    const report = createReport();
    const first = serializeAnalysisJson(report, options);
    const second = serializeAnalysisJson(report, options);
    const artifact = JSON.parse(first) as ReturnType<typeof createAnalysisJson>;

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(Object.keys(artifact)).toEqual([
      "metadata",
      "project",
      "summary",
      "metrics",
      "score",
      "findings",
      "graph",
      "analysis",
    ]);
    expect(artifact.metadata).toMatchObject({
      schema: ANALYSIS_JSON_SCHEMA_URL,
      version: ANALYSIS_JSON_VERSION,
    });
    expect(artifact.project.root).toBe(".");
    expect(artifact.findings.map((finding) => finding.id)).toEqual([
      "critical-finding",
      "warning-finding",
    ]);
    expect(artifact.findings[0]?.location.file).toBe("src/App.tsx");
    expect(artifact.findings[1]?.metadata).toEqual({ size: 200 });
    expect(artifact.graph.nodes.map((node) => node.id)).toEqual(["app", "react", "widget"]);
    expect(artifact.graph.nodes[2]?.metadata).toEqual({});
    expect(artifact.metrics.linesOfCode).toBe(70);
    expect(artifact.metrics.packages).toBe(1);
    expect(artifact.analysis.architectureSummary).toBe(
      "Circular import is the highest-priority risk.",
    );
    expect(artifact.analysis.hotspots[0]).toMatchObject({
      file: "src/App.tsx",
      findingCount: 1,
      priorityScore: 100,
      estimatedScoreRecovery: 0,
      severityCounts: { critical: 1, error: 0, info: 0, warning: 0 },
    });
    expect(artifact.analysis.quickWins).toEqual([]);
    expect(artifact.analysis.roadmap[0]).toMatchObject({ file: "src/App.tsx" });
  });

  it("applies a validated benchmark profile without fabricating a comparison", () => {
    const profile = parseAnalysisBenchmarkProfile({
      cohort: "Next.js production applications",
      framework: "react",
      sampleSize: 40,
      score: { p25: 55, p50: 70, p75: 85 },
      version: "2026.07",
    });
    const artifact = createAnalysisJson(createReport(), { ...options, benchmark: profile });

    expect(artifact.analysis.benchmark).toEqual({
      cohort: "Next.js production applications",
      medianScore: 70,
      percentileBand: "above-median",
      sampleSize: 40,
      status: "available",
      version: "2026.07",
    });
    expect(() => parseAnalysisBenchmarkProfile({ cohort: "bad" })).toThrow("score distribution");
  });

  it("rejects unsafe paths before output", () => {
    const artifact = createAnalysisJson(createReport(), options);
    const [firstFinding] = artifact.findings;
    if (!firstFinding) throw new Error("Test report must contain a finding.");
    const unsafe = {
      ...artifact,
      findings: [
        {
          ...firstFinding,
          location: { ...firstFinding.location, file: "/private/file.ts" },
        },
      ],
    };

    expect(() => validateAnalysisJson(unsafe)).toThrow("absolute paths");
  });

  it("validates then writes UTF-8 JSON", async () => {
    const directory = await mkdtemp(join(tmpdir(), "arcovia-analysis-json-"));
    const output = join(directory, "analysis.json");
    try {
      await writeAnalysisJson(output, createReport(), options);
      expect(await readFile(output, "utf8")).toBe(serializeAnalysisJson(createReport(), options));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("builds a self-contained, offline HTML report from sanitized analysis data", async () => {
    const html = await new HtmlReporter().render(createReport());

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain('rel="icon" type="image/png" href="data:image/png;base64,');
    expect(html).toContain("window.__ARCOVIA_ANALYSIS__=");
    expect(html).toContain("window.__ARCOVIA_BRAND__=");
    expect(html).toContain("ARCHITECTURE HEALTH");
    expect(html).toContain("DEPENDENCY MAP");
    expect(html).not.toContain("Graph view");
    expect(html).not.toContain("List view");
    expect(html).toContain("User code");
    expect(html).toContain("External packages");
    expect(html).toContain("Focus connections");
    expect(html).not.toContain("Raw JSON");
    expect(html).not.toContain('src="http');
    expect(html).not.toContain("/workspace/src/App.tsx");
    expect(html).not.toContain("do-not-export");
    expect(html).not.toContain("process.env.NODE_ENV");
  });
});
