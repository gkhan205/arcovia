import { describe, expect, it } from "vitest";

import type {
  ExportStatement,
  ImportStatement,
  Module,
  ProjectModel,
} from "../src/domain/index.js";
import { ArchitectureGraphBuilder, GraphTraversal } from "../src/graph/index.js";

function createModule(id: string, fileId: string, path: string): Module {
  return {
    dependencies: [],
    exports: [],
    fileId,
    functionCount: 0,
    id,
    imports: [],
    lineCount: 1,
    path,
  };
}

function createImport(fileId: string, source: string, dynamic = false): ImportStatement {
  return {
    fileId,
    isDynamic: dynamic,
    isTypeOnly: false,
    line: 1,
    source,
    specifiers: [],
    type: dynamic ? "dynamic" : source.startsWith(".") ? "relative" : "package",
  };
}

function createReExport(fileId: string, source: string): ExportStatement {
  return {
    fileId,
    isAnonymous: false,
    isDefault: false,
    isTypeOnly: false,
    line: 1,
    name: "*",
    source,
  };
}

function createModel(
  modules: readonly Module[],
  imports: readonly ImportStatement[],
  exports: readonly ExportStatement[] = [],
): ProjectModel {
  return {
    components: [],
    contexts: [],
    exports,
    hooks: [],
    imports,
    modules,
    parseErrors: [],
    routes: [],
    symbols: [],
  };
}

describe("ArchitectureGraphBuilder", () => {
  it("builds local, external, dynamic, and broken import edges deterministically", () => {
    const model = createModel(
      [
        createModule("module-a", "file-a", "src/a.ts"),
        createModule("module-b", "file-b", "src/b.ts"),
      ],
      [
        createImport("file-a", "./b"),
        createImport("file-a", "./b", true),
        createImport("file-a", "react"),
        createImport("file-a", "./missing"),
        createImport("file-b", "./a"),
      ],
    );

    const graph = new ArchitectureGraphBuilder().build(model);
    const localEdge = graph.edges.find(
      (edge) => edge.source === "module-a" && edge.target === "module-b",
    );

    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(4);
    expect(localEdge?.isDynamic).toBe(true);
    expect(graph.edges.filter((edge) => edge.isExternal)).toHaveLength(1);
    expect(graph.edges.filter((edge) => edge.isBroken)).toHaveLength(1);
    expect(graph.cycles).toHaveLength(1);
    expect(graph.cycles[0]?.nodes).toEqual(["module-a", "module-b"]);
    expect(graph.statistics.connectedComponents).toBe(1);
  });

  it("detects self imports and isolated modules without classifying them", () => {
    const model = createModel(
      [
        createModule("self", "file-self", "src/self.ts"),
        createModule("orphan", "file-orphan", "src/orphan.ts"),
      ],
      [createImport("file-self", "./self")],
    );

    const graph = new ArchitectureGraphBuilder().build(model);

    expect(graph.cycles).toHaveLength(1);
    expect(graph.cycles[0]?.length).toBe(1);
    expect(graph.orphans).toEqual(["orphan"]);
    expect(graph.statistics.orphans).toBe(1);
  });

  it("follows barrel re-exports so a consumed barrel keeps its modules connected", () => {
    const graph = new ArchitectureGraphBuilder().build(
      createModel(
        [
          createModule("app", "file-app", "src/app.ts"),
          createModule("barrel", "file-barrel", "src/constants/index.ts"),
          createModule("constant", "file-constant", "src/constants/community.ts"),
        ],
        [createImport("file-app", "./constants")],
        [createReExport("file-barrel", "./community")],
      ),
    );

    expect(graph.edges).toContainEqual(
      expect.objectContaining({ source: "barrel", target: "constant" }),
    );
    expect(graph.orphans).not.toContain("constant");
  });

  it("resolves the conventional Next.js @/ alias to source modules", () => {
    const graph = new ArchitectureGraphBuilder().build(
      createModel(
        [
          createModule("app", "file-app", "src/app/page.tsx"),
          createModule("constant", "file-constant", "src/common/constants/community.ts"),
        ],
        [createImport("file-app", "@/common/constants/community")],
      ),
    );

    expect(graph.edges).toContainEqual(
      expect.objectContaining({ source: "app", target: "constant", isExternal: false }),
    );
    expect(graph.orphans).not.toContain("constant");
  });

  it("provides adjacency-list traversal for dependencies, dependents, and paths", () => {
    const model = createModel(
      [
        createModule("module-a", "file-a", "src/a.ts"),
        createModule("module-b", "file-b", "src/b.ts"),
        createModule("module-c", "file-c", "src/c.ts"),
      ],
      [createImport("file-a", "./b"), createImport("file-b", "./c")],
    );
    const graph = new ArchitectureGraphBuilder().build(model);
    const traversal = new GraphTraversal(graph);

    expect(traversal.getChildren("module-a").map((node) => node.id)).toEqual(["module-b"]);
    expect(traversal.findDependencies("module-a").map((node) => node.id)).toEqual([
      "module-b",
      "module-c",
    ]);
    expect(traversal.findDependents("module-c").map((node) => node.id)).toEqual([
      "module-a",
      "module-b",
    ]);
    expect(traversal.findPath("module-a", "module-c")?.map((node) => node.id)).toEqual([
      "module-a",
      "module-b",
      "module-c",
    ]);
  });
});
