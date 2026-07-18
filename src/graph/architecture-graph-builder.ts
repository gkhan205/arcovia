import { createHash } from "node:crypto";
import { posix } from "node:path";

import {
  type ArchitectureGraph,
  EdgeType,
  type ExportStatement,
  type GraphCycle,
  type GraphEdge,
  type GraphNode,
  type GraphStatistics,
  type ImportStatement,
  type Module,
  NodeType,
  type ProjectModel,
} from "../domain/index.js";

import { GraphValidationError } from "./graph-validation-error.js";

/** Builds the serializable import layer of Arcovia's architecture graph. */
export class ArchitectureGraphBuilder {
  /** Builds and validates a graph from a parsed project model. */
  public build(model: ProjectModel): ArchitectureGraph {
    const moduleByFileId = new Map(model.modules.map((module) => [module.fileId, module]));
    const nodes = new Map(model.modules.map((module) => [module.id, createModuleNode(module)]));
    const edges = buildEdges(
      [...model.imports, ...reExportDependencies(model.exports)],
      moduleByFileId,
      model.modules,
      nodes,
    );
    const immutableNodes = [...nodes.values()].sort(sortById);
    const immutableEdges = [...edges.values()].sort(sortById);
    validateGraph(immutableNodes, immutableEdges);
    const adjacency = createAdjacency(immutableNodes, immutableEdges);
    const cycles = findCycles(adjacency);
    const orphans = immutableNodes
      .filter(
        (node) =>
          (adjacency.children.get(node.id)?.size ?? 0) === 0 &&
          (adjacency.parents.get(node.id)?.size ?? 0) === 0,
      )
      .map((node) => node.id);

    return {
      cycles,
      edges: immutableEdges,
      nodes: immutableNodes,
      orphans,
      statistics: createStatistics(immutableNodes, immutableEdges, cycles, orphans, adjacency),
    };
  }
}

interface Adjacency {
  readonly children: ReadonlyMap<string, ReadonlySet<string>>;
  readonly parents: ReadonlyMap<string, ReadonlySet<string>>;
}

interface ResolvedTarget {
  readonly id: string;
  readonly isBroken: boolean;
  readonly isExternal: boolean;
  readonly node: GraphNode;
}

function buildEdges(
  imports: readonly ImportStatement[],
  moduleByFileId: ReadonlyMap<string, Module>,
  modules: readonly Module[],
  nodes: Map<string, GraphNode>,
): Map<string, GraphEdge> {
  const edges = new Map<string, GraphEdge>();
  for (const statement of imports) {
    const source = moduleByFileId.get(statement.fileId);
    if (source === undefined) continue;
    const target = resolveTarget(statement, source, modules);
    if (!nodes.has(target.id)) nodes.set(target.id, target.node);
    const edgeKey = `${source.id}:${target.id}`;
    const existing = edges.get(edgeKey);
    edges.set(edgeKey, {
      id: createId(`edge:${edgeKey}`),
      isBroken: target.isBroken,
      isDynamic: existing?.isDynamic === true || statement.isDynamic,
      isExternal: target.isExternal,
      source: source.id,
      target: target.id,
      type: EdgeType.Import,
    });
  }
  return edges;
}

function reExportDependencies(exports: readonly ExportStatement[]): readonly ImportStatement[] {
  return exports.flatMap((entry) =>
    entry.source === undefined
      ? []
      : [
          {
            fileId: entry.fileId,
            isDynamic: false,
            isTypeOnly: entry.isTypeOnly,
            line: entry.line,
            source: entry.source,
            specifiers: [entry.name],
            type: entry.source.startsWith(".") ? "relative" : "package",
          },
        ],
  );
}

function resolveTarget(
  statement: ImportStatement,
  source: Module,
  modules: readonly Module[],
): ResolvedTarget {
  const resolvedModule = resolveLocalModule(statement.source, source.path, modules);
  if (resolvedModule !== undefined) {
    return {
      id: resolvedModule.id,
      isBroken: false,
      isExternal: false,
      node: createModuleNode(resolvedModule),
    };
  }
  if (statement.type === "relative") {
    const id = createId(`missing:${source.path}:${statement.source}`);
    return {
      id,
      isBroken: true,
      isExternal: false,
      node: {
        id,
        label: statement.source,
        metadata: { missing: true },
        path: statement.source,
        type: NodeType.Missing,
      },
    };
  }
  const id = createId(`package:${statement.source}`);
  return {
    id,
    isBroken: false,
    isExternal: true,
    node: {
      id,
      label: statement.source,
      metadata: {},
      path: statement.source,
      type: NodeType.Package,
    },
  };
}

function resolveLocalModule(
  source: string,
  sourcePath: string,
  modules: readonly Module[],
): Module | undefined {
  if (source.startsWith(".")) {
    return modules.find((module) => relativeCandidates(source, sourcePath).includes(module.path));
  }

  if (!source.startsWith("@/")) return undefined;

  const normalizedAlias = `src/${source.slice(2)}`;
  const aliasMatches = modules.filter(
    (module) =>
      stripExtension(module.path) === normalizedAlias ||
      stripExtension(module.path).endsWith(`/${normalizedAlias}`),
  );
  return aliasMatches.length === 1 ? aliasMatches[0] : undefined;
}

function relativeCandidates(source: string, sourcePath: string): readonly string[] {
  const base = posix.normalize(posix.join(posix.dirname(sourcePath), source));
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];
  return [
    base,
    ...extensions.map((extension) => `${base}${extension}`),
    ...extensions.map((extension) => `${base}/index${extension}`),
  ];
}

function createModuleNode(module: Module): GraphNode {
  return {
    id: module.id,
    label: posix.basename(module.path),
    metadata: {
      fileId: module.fileId,
      functionCount: module.functionCount,
      lineCount: module.lineCount,
    },
    path: module.path,
    type: NodeType.Module,
  };
}

function createAdjacency(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): Adjacency {
  const children = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  const parents = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of edges) {
    children.get(edge.source)?.add(edge.target);
    parents.get(edge.target)?.add(edge.source);
  }
  return { children, parents };
}

function findCycles(adjacency: Adjacency): readonly GraphCycle[] {
  const complete = new Set<string>();
  const stack: string[] = [];
  const cycles = new Map<string, GraphCycle>();
  const visit = (node: string): void => {
    const index = stack.indexOf(node);
    if (index >= 0) {
      const nodes = canonicalizeCycle(stack.slice(index));
      const id = createId(`cycle:${nodes.join(":")}`);
      cycles.set(id, { id, length: nodes.length, nodes });
      return;
    }
    if (complete.has(node)) return;
    stack.push(node);
    for (const child of adjacency.children.get(node) ?? []) {
      // A file importing itself is an invalid edge, but it is not a multi-module
      // circular dependency. Keep the edge visible in the graph without
      // escalating it through the circular-import rule.
      if (child !== node) visit(child);
    }
    stack.pop();
    complete.add(node);
  };
  for (const node of adjacency.children.keys()) visit(node);
  return [...cycles.values()].sort(sortById);
}

function canonicalizeCycle(nodes: readonly string[]): readonly string[] {
  const rotations = nodes.map((_, index) => [...nodes.slice(index), ...nodes.slice(0, index)]);
  return rotations.sort((left, right) => left.join("").localeCompare(right.join("")))[0] ?? [];
}

function createStatistics(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  cycles: readonly GraphCycle[],
  orphans: readonly string[],
  adjacency: Adjacency,
): GraphStatistics {
  const nodeCount = nodes.length;
  return {
    averageFanIn: nodeCount === 0 ? 0 : edges.length / nodeCount,
    averageFanOut: nodeCount === 0 ? 0 : edges.length / nodeCount,
    connectedComponents: countConnectedComponents(adjacency),
    cycles: cycles.length,
    edges: edges.length,
    maxDepth: calculateMaxDepth(adjacency),
    nodes: nodeCount,
    orphans: orphans.length,
  };
}

function countConnectedComponents(adjacency: Adjacency): number {
  const visited = new Set<string>();
  let components = 0;
  for (const node of adjacency.children.keys()) {
    if (visited.has(node)) continue;
    components += 1;
    const queue = [node];
    visited.add(node);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;
      const neighbours = [
        ...(adjacency.children.get(current) ?? []),
        ...(adjacency.parents.get(current) ?? []),
      ];
      for (const neighbour of neighbours) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          queue.push(neighbour);
        }
      }
    }
  }
  return components;
}

function calculateMaxDepth(adjacency: Adjacency): number {
  const cache = new Map<string, number>();
  const active = new Set<string>();
  const depth = (node: string): number => {
    const known = cache.get(node);
    if (known !== undefined) return known;
    if (active.has(node)) return 0;
    active.add(node);
    let maximum = 0;
    for (const child of adjacency.children.get(node) ?? [])
      maximum = Math.max(maximum, 1 + depth(child));
    active.delete(node);
    cache.set(node, maximum);
    return maximum;
  };
  return Math.max(0, ...[...adjacency.children.keys()].map(depth));
}

function validateGraph(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): void {
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length)
    throw new GraphValidationError("Graph contains duplicate node IDs.");
  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) throw new GraphValidationError("Graph contains duplicate edge IDs.");
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))
      throw new GraphValidationError("Graph contains a broken edge reference.");
    edgeIds.add(edge.id);
  }
}

function stripExtension(path: string): string {
  return path.replace(/\.[^.]+$/u, "");
}

function createId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sortById<T extends { readonly id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}
