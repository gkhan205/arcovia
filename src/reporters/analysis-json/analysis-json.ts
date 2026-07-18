import { writeFile } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";

import type {
  AnalysisReport,
  ArchitectureScore,
  Finding,
  FindingEvidence,
  FindingMetadataValue,
  GraphEdge,
  GraphMetadataValue,
  GraphNode,
  GraphStatistics,
} from "../../domain/index.js";
import { Severity } from "../../domain/index.js";

/** Current public schema identity for the Arcovia Analysis Format. */
export const ANALYSIS_JSON_SCHEMA_URL = "https://schema.arcovia.dev/analysis/v1";
export const ANALYSIS_JSON_VERSION = "1.0.0";

const SEVERITY_ORDER: Readonly<Record<Finding["severity"], number>> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
};
const SENSITIVE_KEY = /(?:api[-_]?key|authorization|cookie|password|secret|source|token|username)/i;

type JsonValue =
  | boolean
  | number
  | string
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface AnalysisJsonMetadata {
  readonly cliVersion: string;
  readonly duration: number;
  readonly engineVersion: string;
  readonly generatedAt: string;
  readonly nodeVersion: string;
  readonly os: string;
  readonly platform: string;
  readonly schema: typeof ANALYSIS_JSON_SCHEMA_URL;
  readonly version: typeof ANALYSIS_JSON_VERSION;
}

export interface AnalysisJsonProject {
  readonly components: number;
  readonly framework: string;
  readonly id: string;
  readonly modules: number;
  readonly name: string;
  readonly packageManager: string;
  readonly root: ".";
  readonly sourceFiles: number;
  readonly workspace: string;
}

export interface AnalysisJsonSummary {
  readonly critical: number;
  readonly errors: number;
  readonly grade: ArchitectureScore["grade"];
  readonly info: number;
  readonly overallScore: number;
  readonly totalFindings: number;
  readonly warnings: number;
}

export interface AnalysisJsonMetrics {
  readonly components: number;
  readonly contexts: number;
  readonly dependencies: number;
  readonly exports: number;
  readonly hooks: number;
  readonly imports: number;
  readonly linesOfCode: number;
  readonly modules: number;
  readonly packages: number;
  readonly routes: number;
}

export interface AnalysisJsonFinding {
  readonly category: Finding["category"];
  readonly description: string;
  readonly evidence: readonly {
    readonly actual: JsonValue;
    readonly metric: string;
    readonly recommended: JsonValue | null;
  }[];
  readonly id: string;
  readonly location: {
    readonly column: number;
    readonly file: string;
    readonly line: number;
    readonly symbol: string | null;
  };
  readonly metadata: Readonly<Record<string, JsonValue>>;
  readonly rationale: string;
  readonly recommendation: string;
  readonly ruleId: string;
  readonly severity: Finding["severity"];
  readonly title: string;
}

export interface AnalysisJsonGraph {
  readonly edges: readonly GraphEdge[];
  readonly nodes: readonly (Omit<GraphNode, "metadata" | "path"> & {
    readonly metadata: Readonly<Record<string, JsonValue>>;
    readonly path: string;
  })[];
  readonly statistics: GraphStatistics;
}

/** Public, versioned analysis artifact. The property order is part of its diff-friendly contract. */
export interface AnalysisJsonFile {
  readonly metadata: AnalysisJsonMetadata;
  readonly project: AnalysisJsonProject;
  readonly summary: AnalysisJsonSummary;
  readonly metrics: AnalysisJsonMetrics;
  readonly score: ArchitectureScore;
  readonly findings: readonly AnalysisJsonFinding[];
  readonly graph: AnalysisJsonGraph;
  readonly analysis: {
    readonly risks: readonly string[];
    readonly strengths: readonly string[];
    readonly weaknesses: readonly string[];
  };
}

export interface AnalysisJsonOptions {
  readonly cliVersion: string;
  readonly engineVersion: string;
  readonly nodeVersion: string;
  readonly os: string;
  readonly platform: string;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function relativePath(path: string, projectRoot: string): string {
  const normalized = path.replaceAll("\\", "/");
  if (!isAbsolute(path)) {
    return normalized.replace(/^\.\//, "") || ".";
  }

  const pathFromRoot = relative(projectRoot, path).replaceAll("\\", "/");
  return pathFromRoot && !pathFromRoot.startsWith("../") ? pathFromRoot : ".";
}

function sanitizeValue(value: FindingMetadataValue | GraphMetadataValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY.test(key))
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, nestedValue]) => [key, sanitizeValue(nestedValue)]),
    );
  }
  return typeof value === "number" && !Number.isFinite(value) ? null : value;
}

function sanitizeMetadata(
  metadata: Readonly<Record<string, FindingMetadataValue | GraphMetadataValue>>,
): Readonly<Record<string, JsonValue>> {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, value]) => [key, sanitizeValue(value)]),
  );
}

function toEvidence(evidence: readonly FindingEvidence[]): AnalysisJsonFinding["evidence"] {
  return [...evidence]
    .map(({ metric, value }) => ({ actual: sanitizeValue(value), metric, recommended: null }))
    .sort((left, right) => compareText(left.metric, right.metric));
}

function toFinding(finding: Finding, projectRoot: string): AnalysisJsonFinding {
  return {
    category: finding.category,
    description: finding.description,
    evidence: toEvidence(finding.evidence),
    id: finding.id,
    location: {
      column: finding.location.column,
      file: relativePath(finding.location.file, projectRoot),
      line: finding.location.line,
      symbol: finding.location.symbol ?? null,
    },
    metadata: sanitizeMetadata(finding.metadata),
    rationale: finding.rationale,
    recommendation: finding.recommendation,
    ruleId: finding.ruleId,
    severity: finding.severity,
    title: finding.title,
  };
}

function toGraph(report: AnalysisReport): AnalysisJsonGraph {
  const nodes = report.graph.nodes
    .map((node) => ({
      id: node.id,
      label: node.label,
      metadata: sanitizeMetadata(node.metadata),
      path: relativePath(node.path, report.project.root),
      type: node.type,
    }))
    .sort((left, right) => compareText(left.id, right.id));
  const edges = report.graph.edges
    .map((edge) => ({
      id: edge.id,
      isBroken: edge.isBroken,
      isDynamic: edge.isDynamic,
      isExternal: edge.isExternal,
      source: edge.source,
      target: edge.target,
      type: edge.type,
    }))
    .sort((left, right) => compareText(left.id, right.id));
  const statistics = report.graph.statistics;
  return {
    nodes,
    edges,
    statistics: {
      averageFanIn: statistics.averageFanIn,
      averageFanOut: statistics.averageFanOut,
      connectedComponents: statistics.connectedComponents,
      cycles: statistics.cycles,
      edges: statistics.edges,
      maxDepth: statistics.maxDepth,
      nodes: statistics.nodes,
      orphans: statistics.orphans,
    },
  };
}

function toScore(score: ArchitectureScore): ArchitectureScore {
  const breakdown = {
    deductions: score.breakdown.deductions
      .map((deduction) => ({
        category: deduction.category,
        findingCount: deduction.findingCount,
        penalty: deduction.penalty,
        reason: deduction.reason,
        ruleId: deduction.ruleId,
      }))
      .sort(
        (left, right) =>
          compareText(left.category, right.category) || compareText(left.ruleId, right.ruleId),
      ),
    strengths: [...score.breakdown.strengths].sort(compareText),
    weaknesses: [...score.breakdown.weaknesses].sort(compareText),
  };
  const baseScore = {
    breakdown,
    categories: score.categories
      .map((category) => ({
        category: category.category,
        penalty: category.penalty,
        score: category.score,
        weight: category.weight,
      }))
      .sort((left, right) => compareText(left.category, right.category)),
    grade: score.grade,
    metadata: {
      confidence: {
        reason: score.metadata.confidence.reason,
        value: score.metadata.confidence.value,
      },
      criticalFindings: score.metadata.criticalFindings,
      duplicateFindingsIgnored: score.metadata.duplicateFindingsIgnored,
      errorFindings: score.metadata.errorFindings,
      normalizedFindingCount: score.metadata.normalizedFindingCount,
      warningFindings: score.metadata.warningFindings,
    },
    overall: score.overall,
  };
  return score.trend === undefined
    ? baseScore
    : {
        ...baseScore,
        trend: { delta: score.trend.delta, previousOverall: score.trend.previousOverall },
      };
}

function countFindings(findings: readonly Finding[], severity: Finding["severity"]): number {
  return findings.filter((finding) => finding.severity === severity).length;
}

/** Converts an internal AnalysisReport to the public AAF representation without writing it. */
export function createAnalysisJson(
  report: AnalysisReport,
  options: AnalysisJsonOptions,
): AnalysisJsonFile {
  const findings = [...report.findings]
    .sort(
      (left, right) =>
        SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
        compareText(left.ruleId, right.ruleId) ||
        compareText(left.location.file, right.location.file) ||
        left.location.line - right.location.line ||
        left.location.column - right.location.column ||
        compareText(left.id, right.id),
    )
    .map((finding) => toFinding(finding, report.project.root));
  const risks = report.findings
    .filter(
      (finding) => finding.severity === Severity.Critical || finding.severity === Severity.Error,
    )
    .map((finding) => finding.title)
    .sort(compareText);

  return {
    metadata: {
      cliVersion: options.cliVersion,
      duration: report.metadata.duration,
      engineVersion: options.engineVersion,
      generatedAt: report.generatedAt,
      nodeVersion: options.nodeVersion,
      os: options.os,
      platform: options.platform,
      schema: ANALYSIS_JSON_SCHEMA_URL,
      version: ANALYSIS_JSON_VERSION,
    },
    project: {
      components: report.model.components.length,
      framework: report.project.framework,
      id: report.project.id,
      modules: report.model.modules.length,
      name: report.project.name,
      packageManager: report.project.packageManager,
      root: ".",
      sourceFiles: report.project.metadata.sourceFiles,
      workspace: report.project.workspace,
    },
    summary: {
      critical: countFindings(report.findings, Severity.Critical),
      errors: countFindings(report.findings, Severity.Error),
      grade: report.score.grade,
      info: countFindings(report.findings, Severity.Info),
      overallScore: report.score.overall,
      totalFindings: report.findings.length,
      warnings: countFindings(report.findings, Severity.Warning),
    },
    metrics: {
      components: report.model.components.length,
      contexts: report.model.contexts.length,
      dependencies: report.metrics.dependencies,
      exports: report.model.exports.length,
      hooks: report.model.hooks.length,
      imports: report.model.imports.length,
      linesOfCode: report.model.modules.reduce((total, module) => total + module.lineCount, 0),
      modules: report.model.modules.length,
      packages: report.graph.nodes.filter((node) => node.type === "package").length,
      routes: report.model.routes.length,
    },
    score: toScore(report.score),
    findings,
    graph: toGraph(report),
    analysis: {
      risks,
      strengths: [...report.score.breakdown.strengths].sort(compareText),
      weaknesses: [...report.score.breakdown.weaknesses].sort(compareText),
    },
  };
}

/** JSON Schema published with the v1 analysis artifact. */
export const ANALYSIS_JSON_SCHEMA = {
  $id: ANALYSIS_JSON_SCHEMA_URL,
  $schema: "https://json-schema.org/draft/2020-12/schema",
  additionalProperties: false,
  properties: {
    analysis: { type: "object" },
    findings: { items: { type: "object" }, type: "array" },
    graph: { type: "object" },
    metadata: { type: "object" },
    metrics: { type: "object" },
    project: { type: "object" },
    score: { type: "object" },
    summary: { type: "object" },
  },
  required: ["metadata", "project", "summary", "metrics", "score", "findings", "graph", "analysis"],
  type: "object",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function containsUnsafeMetadata(value: unknown): boolean {
  if (typeof value === "string") return isAbsolute(value);
  if (Array.isArray(value)) return value.some(containsUnsafeMetadata);
  if (isRecord(value)) {
    return Object.entries(value).some(
      ([key, item]) => SENSITIVE_KEY.test(key) || containsUnsafeMetadata(item),
    );
  }
  return typeof value === "number" && !Number.isFinite(value);
}

/** Validates the invariants that make an unknown value a safe, v1 AAF artifact. */
export function validateAnalysisJson(value: unknown): asserts value is AnalysisJsonFile {
  if (
    !isRecord(value) ||
    Object.keys(value).join(",") !==
      "metadata,project,summary,metrics,score,findings,graph,analysis"
  ) {
    throw new TypeError(
      "Analysis JSON must contain the eight v1 sections in their canonical order.",
    );
  }
  if (
    !isRecord(value.metadata) ||
    value.metadata.schema !== ANALYSIS_JSON_SCHEMA_URL ||
    value.metadata.version !== ANALYSIS_JSON_VERSION
  ) {
    throw new TypeError("Analysis JSON metadata must identify the supported v1 schema.");
  }
  if (!Array.isArray(value.findings) || !isRecord(value.project) || value.project.root !== ".") {
    throw new TypeError("Analysis JSON must contain findings and a relative project root.");
  }
  const findingsContainUnsafeMetadata = value.findings.some(
    (finding) => isRecord(finding) && containsUnsafeMetadata(finding.metadata),
  );
  const graphContainsUnsafeMetadata =
    isRecord(value.graph) &&
    Array.isArray(value.graph.nodes) &&
    value.graph.nodes.some((node) => isRecord(node) && containsUnsafeMetadata(node.metadata));
  const pathsAreUnsafe =
    value.findings.some(
      (finding) =>
        isRecord(finding) &&
        isRecord(finding.location) &&
        isAbsolute(String(finding.location.file)),
    ) ||
    (isRecord(value.graph) &&
      Array.isArray(value.graph.nodes) &&
      value.graph.nodes.some((node) => isRecord(node) && isAbsolute(String(node.path))));
  if (findingsContainUnsafeMetadata || graphContainsUnsafeMetadata || pathsAreUnsafe) {
    throw new TypeError(
      "Analysis JSON must not contain absolute paths, non-finite values, or sensitive metadata.",
    );
  }
}

/** Serializes a validated AAF artifact using UTF-8 compatible, two-space JSON and a trailing newline. */
export function serializeAnalysisJson(
  report: AnalysisReport,
  options: AnalysisJsonOptions,
): string {
  const artifact = createAnalysisJson(report, options);
  validateAnalysisJson(artifact);
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

/** Validates then writes a complete analysis artifact. */
export async function writeAnalysisJson(
  outputPath: string,
  report: AnalysisReport,
  options: AnalysisJsonOptions,
): Promise<void> {
  const serialized = serializeAnalysisJson(report, options);
  validateAnalysisJson(JSON.parse(serialized));
  await writeFile(outputPath, serialized, "utf8");
}
