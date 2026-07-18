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

/** A file-level cluster of findings used to prioritize remediation work. */
export interface AnalysisJsonHotspot {
  /** Category-weighted recovery if every displayed finding in this file is resolved. */
  readonly estimatedScoreRecovery: number;
  readonly file: string;
  readonly findingCount: number;
  readonly priorityScore: number;
  readonly recommendation: string;
  readonly severityCounts: Readonly<Record<AnalysisJsonFinding["severity"], number>>;
}

/** An empirical score distribution supplied by an Arcovia benchmark corpus. */
export interface AnalysisBenchmarkProfile {
  readonly cohort: string;
  readonly framework?: string;
  readonly sampleSize: number;
  readonly score: {
    readonly p25: number;
    readonly p50: number;
    readonly p75: number;
  };
  readonly version: string;
}

export interface AnalysisJsonBenchmark {
  readonly cohort?: string;
  readonly medianScore?: number;
  readonly percentileBand?: "above-median" | "below-median" | "middle-half" | "top-quartile";
  readonly reason?: string;
  readonly sampleSize?: number;
  readonly status: "available" | "unavailable";
  readonly version?: string;
}

/** A compact historical score point retained from prior Arcovia analyses. */
export interface AnalysisJsonHistoryPoint {
  readonly generatedAt: string;
  readonly overallScore: number;
  readonly reportPath?: string;
}

/** A concrete remediation action derived from a project hotspot. */
export interface AnalysisJsonRemediationAction {
  readonly estimatedScoreRecovery: number;
  readonly file: string;
  readonly findingCount: number;
  readonly recommendation: string;
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
    readonly architectureSummary: string;
    readonly benchmark: AnalysisJsonBenchmark;
    readonly hotspots: readonly AnalysisJsonHotspot[];
    readonly history: readonly AnalysisJsonHistoryPoint[];
    readonly risks: readonly string[];
    readonly quickWins: readonly AnalysisJsonRemediationAction[];
    readonly roadmap: readonly AnalysisJsonRemediationAction[];
    readonly strengths: readonly string[];
    readonly weaknesses: readonly string[];
  };
}

export interface AnalysisJsonOptions {
  readonly benchmark?: AnalysisBenchmarkProfile;
  readonly cliVersion: string;
  readonly engineVersion: string;
  readonly history?: readonly AnalysisJsonHistoryPoint[];
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
    categoryWeightedScore: score.breakdown.categoryWeightedScore,
    criticalRiskAdjustment: score.breakdown.criticalRiskAdjustment,
    maintenanceBurden: score.breakdown.maintenanceBurden,
    contributors: score.breakdown.contributors
      .map((contributor) => ({ ...contributor }))
      .sort((left, right) => right.impact - left.impact || compareText(left.label, right.label)),
    deductions: score.breakdown.deductions
      .map((deduction) => ({
        category: deduction.category,
        findingCount: deduction.findingCount,
        penalty: deduction.penalty,
        reason: deduction.reason,
        ruleId: deduction.ruleId,
        weight: deduction.weight,
      }))
      .sort(
        (left, right) =>
          compareText(left.category, right.category) || compareText(left.ruleId, right.ruleId),
      ),
    strengths: [...score.breakdown.strengths].sort(compareText),
    summary: score.breakdown.summary,
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

function createHotspots(
  findings: readonly AnalysisJsonFinding[],
  score: ArchitectureScore,
): readonly AnalysisJsonHotspot[] {
  const grouped = new Map<string, AnalysisJsonFinding[]>();
  for (const finding of findings) {
    grouped.set(finding.location.file, [...(grouped.get(finding.location.file) ?? []), finding]);
  }
  const severityWeight: Readonly<Record<AnalysisJsonFinding["severity"], number>> = {
    critical: 100,
    error: 40,
    warning: 10,
    info: 1,
  };
  return [...grouped.entries()]
    .map(([file, fileFindings]) => {
      const sorted = [...fileFindings].sort(
        (left, right) => severityRank(left.severity) - severityRank(right.severity),
      );
      const severityCounts: Record<AnalysisJsonFinding["severity"], number> = {
        critical: 0,
        error: 0,
        info: 0,
        warning: 0,
      };
      for (const finding of fileFindings) severityCounts[finding.severity] += 1;
      const topFinding = sorted[0];
      const estimatedScoreRecovery = round(
        fileFindings.reduce((total, finding) => {
          const deduction = score.breakdown.deductions.find(
            (candidate) =>
              candidate.ruleId === finding.ruleId && candidate.category === finding.category,
          );
          const category = score.categories.find(
            (candidate) => candidate.category === finding.category,
          );
          if (deduction === undefined || category === undefined || deduction.findingCount === 0) {
            return total;
          }
          return total + (deduction.penalty / deduction.findingCount) * (category.weight / 100);
        }, 0),
      );
      return {
        estimatedScoreRecovery,
        file,
        findingCount: fileFindings.length,
        priorityScore: fileFindings.reduce(
          (total, finding) => total + severityWeight[finding.severity],
          0,
        ),
        recommendation: topFinding?.recommendation ?? "Review this file's architecture signals.",
        severityCounts,
      };
    })
    .sort(
      (left, right) =>
        right.priorityScore - left.priorityScore ||
        right.findingCount - left.findingCount ||
        compareText(left.file, right.file),
    );
}

function createBenchmark(
  score: number,
  framework: string,
  profile: AnalysisBenchmarkProfile | undefined,
): AnalysisJsonBenchmark {
  if (profile === undefined) {
    return {
      reason: "No empirical benchmark corpus was supplied for this analysis.",
      status: "unavailable",
    };
  }
  if (profile.framework !== undefined && profile.framework !== framework) {
    return {
      reason: `Benchmark framework ${profile.framework} does not match project framework ${framework}.`,
      status: "unavailable",
    };
  }
  const percentileBand =
    score >= profile.score.p75
      ? "top-quartile"
      : score >= profile.score.p50
        ? "above-median"
        : score >= profile.score.p25
          ? "middle-half"
          : "below-median";
  return {
    cohort: profile.cohort,
    medianScore: profile.score.p50,
    percentileBand,
    sampleSize: profile.sampleSize,
    status: "available",
    version: profile.version,
  };
}

function createActionPlan(
  hotspots: readonly AnalysisJsonHotspot[],
  findings: readonly AnalysisJsonFinding[],
): {
  readonly quickWins: readonly AnalysisJsonRemediationAction[];
  readonly roadmap: readonly AnalysisJsonRemediationAction[];
} {
  const quickRules = new Set(["duplicate-imports", "orphan-module", "unused-export"]);
  const quickFiles = new Set(
    findings
      .filter((finding) => quickRules.has(finding.ruleId))
      .map((finding) => finding.location.file),
  );
  const toAction = (hotspot: AnalysisJsonHotspot): AnalysisJsonRemediationAction => ({
    estimatedScoreRecovery: hotspot.estimatedScoreRecovery,
    file: hotspot.file,
    findingCount: hotspot.findingCount,
    recommendation: hotspot.recommendation,
  });
  const quickWins = hotspots
    .filter((hotspot) => quickFiles.has(hotspot.file))
    .slice(0, 5)
    .map(toAction);
  const quickFileSet = new Set(quickWins.map((action) => action.file));
  return {
    quickWins,
    roadmap: hotspots
      .filter((hotspot) => !quickFileSet.has(hotspot.file))
      .slice(0, 3)
      .map(toAction),
  };
}

function severityRank(severity: AnalysisJsonFinding["severity"]): number {
  return SEVERITY_ORDER[severity];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
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
  const hotspots = createHotspots(findings, report.score);
  const actionPlan = createActionPlan(hotspots, findings);

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
      architectureSummary: report.score.breakdown.summary,
      benchmark: createBenchmark(report.score.overall, report.project.framework, options.benchmark),
      hotspots,
      history: [
        ...(options.history ?? []),
        { generatedAt: report.generatedAt, overallScore: report.score.overall },
      ]
        .sort((left, right) => left.generatedAt.localeCompare(right.generatedAt))
        .slice(-8),
      risks,
      quickWins: actionPlan.quickWins,
      roadmap: actionPlan.roadmap,
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
