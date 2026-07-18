/** Node categories supported by Arcovia's architecture graph. */
export enum NodeType {
  Component = "component",
  Context = "context",
  Hook = "hook",
  Missing = "missing",
  Module = "module",
  Package = "package",
  Route = "route",
}

/** Relationship categories supported by Arcovia's architecture graph. */
export enum EdgeType {
  Import = "import",
}

/** JSON-compatible value stored as graph metadata. */
export type GraphMetadataValue =
  | boolean
  | number
  | string
  | null
  | readonly GraphMetadataValue[]
  | { readonly [key: string]: GraphMetadataValue };

/** A serializable node in the architecture graph. */
export interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly metadata: Readonly<Record<string, GraphMetadataValue>>;
  readonly path: string;
  readonly type: NodeType;
}

/** A directed relationship between two graph nodes. */
export interface GraphEdge {
  readonly id: string;
  readonly isBroken: boolean;
  readonly isDynamic: boolean;
  readonly isExternal: boolean;
  readonly source: string;
  readonly target: string;
  readonly type: EdgeType;
}

/** A circular path found in the architecture graph. */
export interface GraphCycle {
  readonly id: string;
  readonly length: number;
  readonly nodes: readonly string[];
}

/** Structural measurements collected without assigning architectural quality. */
export interface GraphStatistics {
  readonly averageFanIn: number;
  readonly averageFanOut: number;
  readonly connectedComponents: number;
  readonly cycles: number;
  readonly edges: number;
  readonly maxDepth: number;
  readonly nodes: number;
  readonly orphans: number;
}

/** The serializable architecture graph used by later analysis stages. */
export interface ArchitectureGraph {
  readonly cycles: readonly GraphCycle[];
  readonly edges: readonly GraphEdge[];
  readonly nodes: readonly GraphNode[];
  readonly orphans: readonly string[];
  readonly statistics: GraphStatistics;
}

/** Backwards-compatible name for Arcovia's architecture graph. */
export type DependencyGraph = ArchitectureGraph;
export type Cycle = GraphCycle;
