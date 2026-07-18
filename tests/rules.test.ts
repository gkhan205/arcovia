import { describe, expect, it } from "vitest";

import {
  type ArchitectureGraph,
  type Finding,
  FrameworkType,
  NodeType,
  PackageManager,
  type Project,
  type ProjectModel,
  Severity,
  WorkspaceType,
} from "../src/domain/index.js";
import {
  DuplicateRuleIdError,
  INITIAL_RULES,
  type Rule,
  type RuleContext,
  RuleEngine,
  RuleRegistry,
} from "../src/rules/index.js";
import { Logger } from "../src/shared/index.js";

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
    totalFiles: 0,
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

function createContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    configuration: { concurrency: 2, rules: {}, timeoutMs: 50 },
    graph,
    logger: new Logger({ level: "ERROR", writer: { write: () => undefined } }),
    model,
    project,
    ...overrides,
  };
}

function createRule(overrides: Partial<Rule> = {}): Rule {
  return {
    category: "architecture",
    defaultSeverity: Severity.Warning,
    description: "Test rule.",
    execute: async () => [createFinding("finding-1")],
    id: "test-rule",
    name: "Test rule",
    supports: () => true,
    tags: [],
    version: "1.0.0",
    ...overrides,
  };
}

function createFinding(id: string) {
  return {
    category: "architecture" as const,
    description: "Duplicate finding.",
    evidence: [],
    id,
    location: { column: 1, file: "src/app.ts", line: 3 },
    metadata: {},
    recommendation: "Improve the module.",
    rationale: "The test finding exists to verify collection behavior.",
    ruleId: "test-rule",
    severity: Severity.Warning,
    title: "Test finding",
  };
}

function createExport(fileId: string, name: string, isDefault = false) {
  return {
    fileId,
    isAnonymous: false,
    isDefault,
    isTypeOnly: false,
    line: 1,
    name,
  };
}

function createProjectFile(id: string, relativePath: string) {
  return {
    absolutePath: `/project/${relativePath}`,
    extension: relativePath.slice(relativePath.lastIndexOf(".")),
    id,
    isIgnored: false,
    isSkipped: false,
    isStory: false,
    isTest: false,
    lastModified: 0,
    path: `/project/${relativePath}`,
    relativePath,
    size: 1,
  };
}

describe("RuleEngine", () => {
  it("exposes the supported initial deterministic rule catalog", () => {
    expect(INITIAL_RULES.map((rule) => rule.id)).toContain("no-circular-imports");
    expect(INITIAL_RULES.map((rule) => rule.id)).toContain("large-component");
    expect(INITIAL_RULES.map((rule) => rule.id)).toContain("high-fan-out");
    expect(INITIAL_RULES.map((rule) => rule.id)).not.toContain("duplicate-component-name");
  });

  it("emits evidence-based circular dependency findings", async () => {
    const circularRule = INITIAL_RULES.find((rule) => rule.id === "no-circular-imports");
    if (circularRule === undefined) {
      throw new DuplicateRuleIdError("missing-circular-rule");
    }

    const findings = await circularRule.execute(
      createContext({
        graph: {
          ...graph,
          cycles: [{ id: "cycle", length: 2, nodes: ["module-a", "module-b"] }],
          nodes: [
            {
              id: "module-a",
              label: "a.ts",
              metadata: { fileId: "file-a" },
              path: "src/a.ts",
              type: NodeType.Module,
            },
            {
              id: "module-b",
              label: "b.ts",
              metadata: { fileId: "file-b" },
              path: "src/b.ts",
              type: NodeType.Module,
            },
          ],
        },
        project: {
          ...project,
          files: [createProjectFile("file-a", "src/a.ts"), createProjectFile("file-b", "src/b.ts")],
        },
      }),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence).toContainEqual({ metric: "cycleLength", value: 2 });
    expect(findings[0]?.location.file).toBe("src/a.ts");
    expect(findings[0]?.description).toContain("src/a.ts → src/b.ts → src/a.ts");
    expect(findings[0]?.evidence).toContainEqual({
      metric: "cyclePaths",
      value: ["src/a.ts", "src/b.ts", "src/a.ts"],
    });
  });

  it("does not report tooling configuration files as orphan modules", async () => {
    const orphanRule = INITIAL_RULES.find((rule) => rule.id === "orphan-module");
    if (orphanRule === undefined) throw new DuplicateRuleIdError("missing-orphan-rule");

    const findings = await orphanRule.execute(
      createContext({
        graph: {
          ...graph,
          nodes: [
            {
              id: "postcss-module",
              label: "postcss.config.mjs",
              metadata: { fileId: "postcss-file" },
              path: "postcss.config.mjs",
              type: NodeType.Module,
            },
          ],
          orphans: ["postcss-module"],
        },
        project: {
          ...project,
          files: [
            {
              absolutePath: "/project/postcss.config.mjs",
              extension: ".mjs",
              id: "postcss-file",
              isIgnored: false,
              isSkipped: false,
              isStory: false,
              isTest: false,
              lastModified: 0,
              path: "/project/postcss.config.mjs",
              relativePath: "postcss.config.mjs",
              size: 1,
            },
          ],
        },
      }),
    );

    expect(findings).toEqual([]);
  });

  it("does not report Next.js convention-file exports as unused", async () => {
    const unusedRule = INITIAL_RULES.find((rule) => rule.id === "unused-export");
    if (unusedRule === undefined) throw new DuplicateRuleIdError("missing-unused-export-rule");

    const findings = await unusedRule.execute(
      createContext({
        model: {
          ...model,
          exports: [
            createExport("page-file", "BlogPage", true),
            createExport("page-file", "revalidate"),
            createExport("page-file", "generateStaticParams"),
            createExport("page-file", "generateMetadata"),
          ],
        },
        project: {
          ...project,
          files: [createProjectFile("page-file", "src/app/blogs/[id]/page.tsx")],
          framework: FrameworkType.Next,
        },
      }),
    );

    expect(findings).toEqual([]);
  });

  it("respects per-rule threshold overrides", async () => {
    const largeComponentRule = INITIAL_RULES.find((rule) => rule.id === "large-component");
    if (largeComponentRule === undefined) {
      throw new DuplicateRuleIdError("missing-large-component-rule");
    }

    const findings = await largeComponentRule.execute(
      createContext({
        configuration: { rules: { "large-component": { maxLines: 5 } }, timeoutMs: 50 },
        model: {
          ...model,
          components: [
            {
              exports: [],
              fileId: "file-component",
              hooks: [],
              id: "component",
              jsxDepth: 1,
              lineCount: 6,
              name: "Example",
              props: [],
              type: "function",
            },
          ],
        },
      }),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence).toContainEqual({ metric: "threshold", value: 5 });
  });

  it("rejects duplicate rule IDs during registration", () => {
    const registry = new RuleRegistry();
    registry.register(createRule());

    expect(() => registry.register(createRule())).toThrow(DuplicateRuleIdError);
  });

  it("skips disabled and unsupported rules", async () => {
    const registry = new RuleRegistry();
    registry.register(createRule({ id: "disabled" }));
    registry.register(createRule({ id: "unsupported", supports: () => false }));
    const engine = new RuleEngine(registry);

    const findings = await engine.execute(
      createContext({ configuration: { rules: { disabled: "off" }, timeoutMs: 50 } }),
    );

    expect(findings).toEqual([]);
  });

  it("isolates failures and timeouts while collecting normalized deduplicated findings", async () => {
    const warnings: string[] = [];
    const registry = new RuleRegistry();
    registry.register(
      createRule({
        execute: async () => [createFinding("finding-2"), createFinding("finding-1")],
      }),
    );
    registry.register(
      createRule({
        id: "failing",
        execute: async () => Promise.reject(new DuplicateRuleIdError("execution")),
      }),
    );
    registry.register(
      createRule({
        id: "slow",
        execute: async () => new Promise<readonly Finding[]>(() => undefined),
      }),
    );
    const engine = new RuleEngine(registry);

    const findings = await engine.execute(
      createContext({
        configuration: { concurrency: 3, rules: {}, timeoutMs: 1 },
        logger: new Logger({
          level: "WARN",
          writer: { write: (message) => warnings.push(message) },
        }),
      }),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe(Severity.Warning);
    expect(warnings.join("")).toContain("Rule failed: failing");
    expect(warnings.join("")).toContain("Rule timed out: slow");
  });

  it("applies configured severity overrides", async () => {
    const registry = new RuleRegistry();
    registry.register(createRule());
    const engine = new RuleEngine(registry);

    const findings = await engine.execute(
      createContext({
        configuration: { rules: { "test-rule": Severity.Critical }, timeoutMs: 50 },
      }),
    );

    expect(findings[0]?.severity).toBe(Severity.Critical);
  });
});
