import type { RuleCategory } from "./rule.js";

/** Letter grade assigned to an architecture health score. */
export type ScoreGrade = "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";

/** Standard categories included in architecture health scoring. */
export type ScoreCategory =
  | "architecture"
  | "imports"
  | "components"
  | "hooks"
  | "context"
  | "routes"
  | "performance"
  | "complexity";

/** A category score and the weight it contributes to the overall score. */
export interface CategoryScore {
  readonly category: ScoreCategory;
  readonly penalty: number;
  readonly score: number;
  readonly weight: number;
}

/** An explainable aggregated deduction from one rule. */
export interface ScoreDeduction {
  readonly category: RuleCategory;
  readonly findingCount: number;
  readonly penalty: number;
  readonly reason: string;
  readonly ruleId: string;
}

/** Strengths and weaknesses used to explain score results. */
export interface ScoreBreakdown {
  readonly deductions: readonly ScoreDeduction[];
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
}

/** Confidence in the completeness of an architecture score. */
export interface ScoreConfidence {
  readonly reason: string;
  readonly value: number;
}

/** Metadata about a score calculation. */
export interface ScoreMetadata {
  readonly confidence: ScoreConfidence;
  readonly criticalFindings: number;
  readonly duplicateFindingsIgnored: number;
  readonly errorFindings: number;
  readonly normalizedFindingCount: number;
  readonly warningFindings: number;
}

/** Future comparison against a prior score snapshot. */
export interface ScoreTrend {
  readonly delta: number;
  readonly previousOverall: number;
}

/** Deterministic architecture health result produced by the Score Engine. */
export interface ArchitectureScore {
  readonly breakdown: ScoreBreakdown;
  readonly categories: readonly CategoryScore[];
  readonly grade: ScoreGrade;
  readonly metadata: ScoreMetadata;
  readonly overall: number;
  readonly trend?: ScoreTrend;
}
