import type { RuleCategory } from "./rule.js";

/** Letter grade assigned to an architecture health score. */
export type ScoreGrade = "A+" | "A" | "A-" | "B+" | "B" | "C+" | "C" | "D" | "F";

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
  /** Risk multiplier assigned to the rule before repeat-deduction decay. */
  readonly weight: number;
}

/** A ranked, human-readable factor behind an architecture score. */
export interface ScoreContributor {
  readonly detail: string;
  /** Points removed from the overall score by this contributor. */
  readonly impact: number;
  readonly label: string;
  readonly type: "category" | "critical-risk" | "maintenance-burden";
}

/** Strengths and weaknesses used to explain score results. */
export interface ScoreBreakdown {
  /** Score calculated from the weighted category health before critical-risk adjustment. */
  readonly categoryWeightedScore: number;
  /** Capped project-wide adjustment for accumulated warning and informational debt. */
  readonly maintenanceBurden: number;
  /** Bounded adjustment which prevents critical findings from being diluted across categories. */
  readonly criticalRiskAdjustment: number;
  readonly contributors: readonly ScoreContributor[];
  readonly deductions: readonly ScoreDeduction[];
  /** Project-specific sentence that explains the overall result. */
  readonly summary: string;
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
