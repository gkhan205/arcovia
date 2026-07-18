import type { ArchitectureGraph, GraphCycle, GraphNode } from "../domain/index.js";

/** Provides efficient adjacency-list traversal over an immutable architecture graph. */
export class GraphTraversal {
  private readonly children: ReadonlyMap<string, readonly string[]>;
  private readonly cycles: readonly GraphCycle[];
  private readonly nodes: ReadonlyMap<string, GraphNode>;
  private readonly parents: ReadonlyMap<string, readonly string[]>;

  public constructor(graph: ArchitectureGraph) {
    this.cycles = graph.cycles;
    this.nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    this.children = createIndex(
      graph.nodes.map((node) => node.id),
      graph.edges.map((edge) => [edge.source, edge.target]),
    );
    this.parents = createIndex(
      graph.nodes.map((node) => node.id),
      graph.edges.map((edge) => [edge.target, edge.source]),
    );
  }

  /** Finds a graph node by its stable ID. */
  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /** Returns direct dependency nodes. */
  public getChildren(id: string): readonly GraphNode[] {
    return this.resolve(this.children.get(id) ?? []);
  }

  /** Returns direct dependent nodes. */
  public getParents(id: string): readonly GraphNode[] {
    return this.resolve(this.parents.get(id) ?? []);
  }

  /** Returns all cycles detected during graph construction. */
  public findCycles(): readonly GraphCycle[] {
    return this.cycles;
  }

  /** Returns all transitive dependencies. */
  public findDependencies(id: string): readonly GraphNode[] {
    return this.findReachable(id, this.children);
  }

  /** Returns all transitive dependents. */
  public findDependents(id: string): readonly GraphNode[] {
    return this.findReachable(id, this.parents);
  }

  /** Finds one directed path between two nodes, if one exists. */
  public findPath(source: string, target: string): readonly GraphNode[] | undefined {
    const previous = new Map<string, string>();
    const queue = [source];
    const visited = new Set(queue);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;
      if (current === target) return this.buildPath(target, previous);
      for (const child of this.children.get(current) ?? []) {
        if (!visited.has(child)) {
          visited.add(child);
          previous.set(child, current);
          queue.push(child);
        }
      }
    }
    return undefined;
  }

  private buildPath(target: string, previous: ReadonlyMap<string, string>): readonly GraphNode[] {
    const ids = [target];
    let current = target;
    while (previous.has(current)) {
      const parent = previous.get(current);
      if (parent === undefined) break;
      ids.push(parent);
      current = parent;
    }
    return this.resolve(ids.reverse());
  }

  private findReachable(
    id: string,
    index: ReadonlyMap<string, readonly string[]>,
  ): readonly GraphNode[] {
    const visited = new Set<string>();
    const queue = [...(index.get(id) ?? [])];
    for (const child of queue) visited.add(child);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;
      for (const next of index.get(current) ?? [])
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
    }
    return this.resolve([...visited].sort());
  }

  private resolve(ids: readonly string[]): readonly GraphNode[] {
    return ids.flatMap((id) => {
      const node = this.nodes.get(id);
      return node === undefined ? [] : [node];
    });
  }
}

function createIndex(
  nodeIds: readonly string[],
  entries: readonly (readonly [string, string])[],
): ReadonlyMap<string, readonly string[]> {
  const index = new Map(nodeIds.map((id) => [id, [] as string[]]));
  for (const [source, target] of entries) index.get(source)?.push(target);
  return new Map([...index].map(([id, values]) => [id, values.sort()]));
}
