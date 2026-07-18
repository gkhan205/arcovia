import { describe, expect, it } from "vitest";

import {
  type ArchitectureGraph,
  type Finding,
  FrameworkType,
  PackageManager,
  type Project,
  type ProjectModel,
  Severity,
  WorkspaceType,
} from "../src/domain/index.js";
import { calculateGrade, ScoreEngine, type ScoreInput } from "../src/score/index.js";

const project: Project = {
  files: [],
  framework: FrameworkType.Unknown,
  id: "project",
  metadata: {
    directories: 0,
    hiddenFiles: 0,
    ignoredFiles: 0,
    scanDuration: 0,
    skippedFiles: 0,
    sourceFiles: 0,
    totalFiles: 100,
    workspacePackages: 1,
  },
  name: "project",
  packageManager: PackageManager.Pnpm,
  root: "/project",
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

function createFinding(id: string, severity: Severity, ruleId = "rule"): Finding {
  return {
    category: "architecture",
    description: "Architecture issue.",
    evidence: [],
    id,
    location: { column: 1, file: "src/app.ts", line: 1 },
    metadata: {},
    rationale: "The architecture needs attention.",
    recommendation: "Fix the architecture.",
    ruleId,
    severity,
    title: "Architecture issue",
  };
}

function createInput(findings: readonly Finding[], totalFiles = 100): ScoreInput {
  return {
    findings,
    graph,
    metrics: {
      components: 0,
      contexts: 0,
      cycles: 0,
      dependencies: 0,
      exports: 0,
      hooks: 0,
      imports: 0,
      totalFiles,
    },
    model,
    project: { ...project, metadata: { ...project.metadata, totalFiles } },
  };
}

describe("ScoreEngine", () => {
  it("returns a perfect, high-confidence score when there are no findings", () => {
    const score = new ScoreEngine().calculate(createInput([]));

    expect(score.overall).toBe(100);
    expect(score.grade).toBe("A+");
    expect(score.categories.every((category) => category.score === 100)).toBe(true);
    expect(score.breakdown.deductions).toEqual([]);
    expect(score.breakdown.contributors).toEqual([]);
    expect(score.breakdown.strengths).toContain("No critical architecture findings were detected.");
  });

  it("deduplicates findings and applies diminishing per-rule penalties", () => {
    const findings = [
      createFinding("one", Severity.Critical),
      createFinding("duplicate", Severity.Critical),
      {
        ...createFinding("two", Severity.Critical),
        location: { column: 1, file: "src/app.ts", line: 2 },
      },
      {
        ...createFinding("three", Severity.Critical),
        location: { column: 1, file: "src/app.ts", line: 3 },
      },
    ];
    const score = new ScoreEngine().calculate(createInput(findings));

    expect(score.metadata.duplicateFindingsIgnored).toBe(1);
    expect(score.breakdown.deductions).toEqual([
      expect.objectContaining({ findingCount: 3, penalty: 27.5, ruleId: "rule", weight: 1 }),
    ]);
    expect(score.categories.find((category) => category.category === "architecture")?.score).toBe(
      72.5,
    );
    expect(score.breakdown.categoryWeightedScore).toBe(91.75);
    expect(score.breakdown.criticalRiskAdjustment).toBe(24);
    expect(score.overall).toBe(67.75);
    expect(score.breakdown.contributors[0]).toEqual(
      expect.objectContaining({ impact: 24, label: "Critical-risk adjustment" }),
    );
  });

  it("derives the overall score from category health plus a bounded critical-risk adjustment", () => {
    const finding = createFinding("critical", Severity.Critical);
    const small = new ScoreEngine().calculate(createInput([finding], 100));
    const large = new ScoreEngine().calculate(createInput([finding], 10_000));
    const weighted = new ScoreEngine().calculate(createInput([finding]), {
      categoryWeights: {
        architecture: 100,
        imports: 0,
        components: 0,
        complexity: 0,
        hooks: 0,
        performance: 0,
        context: 0,
        routes: 0,
      },
    });

    expect(small.overall).toBe(85.5);
    expect(large.overall).toBe(85.5);
    expect(weighted.overall).toBe(75);
    expect(weighted.breakdown.categoryWeightedScore).toBe(85);
    expect(weighted.breakdown.criticalRiskAdjustment).toBe(10);
  });

  it("weights circular dependencies above hygiene findings while bounding repeated hygiene noise", () => {
    const circular = {
      ...createFinding("circular", Severity.Critical, "no-circular-imports"),
      title: "Circular module dependency",
    };
    const unused = Array.from({ length: 100 }, (_, index) =>
      createFinding(`unused-${index}`, Severity.Info, "unused-export"),
    );

    const circularScore = new ScoreEngine().calculate(createInput([circular]));
    const hygieneScore = new ScoreEngine().calculate(createInput(unused));

    expect(circularScore.overall).toBe(83.25);
    expect(circularScore.breakdown.deductions[0]).toEqual(
      expect.objectContaining({ penalty: 22.5, ruleId: "no-circular-imports", weight: 1.5 }),
    );
    expect(hygieneScore.overall).toBeGreaterThan(99);
    expect(hygieneScore.breakdown.deductions[0]?.penalty).toBeLessThanOrEqual(3);
  });

  it("applies a capped maintenance burden to high-volume warning debt", () => {
    const warnings = Array.from({ length: 37 }, (_, index) =>
      createFinding(`warning-${index}`, Severity.Warning, `warning-rule-${index}`),
    );
    const score = new ScoreEngine().calculate(createInput(warnings));

    expect(score.breakdown.maintenanceBurden).toBe(6.69);
    expect(score.breakdown.contributors).toContainEqual(
      expect.objectContaining({ impact: 6.69, label: "Maintenance burden" }),
    );
  });

  it("calculates stable letter grades", () => {
    expect(calculateGrade(97)).toBe("A+");
    expect(calculateGrade(93)).toBe("A");
    expect(calculateGrade(90)).toBe("A-");
    expect(calculateGrade(85)).toBe("B+");
    expect(calculateGrade(75)).toBe("B");
    expect(calculateGrade(65)).toBe("C+");
    expect(calculateGrade(55)).toBe("C");
    expect(calculateGrade(40)).toBe("D");
    expect(calculateGrade(39)).toBe("F");
  });
});
