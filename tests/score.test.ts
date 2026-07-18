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
  });

  it("deduplicates findings and caps the penalty applied by one rule", () => {
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
      expect.objectContaining({ findingCount: 3, penalty: 10, ruleId: "rule" }),
    ]);
    expect(score.categories.find((category) => category.category === "architecture")?.score).toBe(
      90,
    );
  });

  it("normalizes penalties for larger projects and honors category weights", () => {
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

    expect(large.overall).toBeGreaterThan(small.overall);
    expect(weighted.overall).toBe(90);
  });

  it("calculates stable letter grades", () => {
    expect(calculateGrade(97)).toBe("A+");
    expect(calculateGrade(90)).toBe("A");
    expect(calculateGrade(85)).toBe("B+");
    expect(calculateGrade(75)).toBe("B");
    expect(calculateGrade(65)).toBe("C+");
    expect(calculateGrade(55)).toBe("C");
    expect(calculateGrade(40)).toBe("D");
    expect(calculateGrade(39)).toBe("F");
  });
});
