export type { AnalysisReport } from "./analysis-report.js";
export type { Component } from "./component.js";
export type { Dependency, ExportStatement, ImportStatement } from "./dependency.js";
export { DomainValidationError } from "./domain-validation-error.js";
export type { Finding, FindingEvidence, FindingLocation, FindingMetadataValue } from "./finding.js";
export { FrameworkType, PackageManager, WorkspaceType } from "./framework.js";
export type {
  ArchitectureGraph,
  Cycle,
  DependencyGraph,
  GraphCycle,
  GraphEdge,
  GraphMetadataValue,
  GraphNode,
  GraphStatistics,
} from "./graph.js";
export { EdgeType, NodeType } from "./graph.js";
export type { Metadata } from "./metadata.js";
export type { MetricCollection } from "./metric.js";
export type { Context, Hook, ParseError, ProjectModel, Route, Symbol } from "./model.js";
export type { Module } from "./module.js";
export type { Project, ProjectMetadata } from "./project.js";
export type { ProjectFile } from "./project-file.js";
export type { RuleCategory, RuleMetadata } from "./rule.js";
export { Severity } from "./rule.js";
export type {
  ArchitectureScore,
  CategoryScore,
  ScoreBreakdown,
  ScoreCategory,
  ScoreConfidence,
  ScoreDeduction,
  ScoreGrade,
  ScoreMetadata,
  ScoreTrend,
} from "./score.js";
export { isNormalizedPath, validateAnalysisReport } from "./validate-analysis-report.js";
