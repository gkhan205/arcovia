import {
  type ArchitectureGraph,
  type ArchitectureScore,
  type CategoryScore,
  type Finding,
  type MetricCollection,
  type Project,
  type ProjectModel,
  type ScoreCategory,
  type ScoreDeduction,
  type ScoreGrade,
  Severity,
} from "../domain/index.js";

/** Input consumed by the deterministic Score Engine. */
export interface ScoreInput {
  readonly findings: readonly Finding[];
  readonly graph: ArchitectureGraph;
  readonly metrics: MetricCollection;
  readonly model: ProjectModel;
  readonly project: Project;
}

/** Optional scoring settings. Weights are normalized to 100 percent. */
export interface ScoreConfiguration {
  readonly categoryWeights?: Readonly<Partial<Record<ScoreCategory, number>>>;
  readonly maxPenaltyPerRule?: number;
  readonly severityMultipliers?: Readonly<Partial<Record<Severity, number>>>;
  readonly severityPenalties?: Readonly<Partial<Record<Severity, number>>>;
}

const CATEGORIES: readonly ScoreCategory[] = [
  "architecture",
  "imports",
  "components",
  "complexity",
  "hooks",
  "performance",
  "context",
  "routes",
];
const DEFAULT_WEIGHTS: Readonly<Record<ScoreCategory, number>> = {
  architecture: 30,
  imports: 15,
  components: 15,
  complexity: 10,
  hooks: 10,
  performance: 10,
  context: 5,
  routes: 5,
};
const DEFAULT_PENALTIES: Readonly<Record<Severity, number>> = {
  [Severity.Critical]: 10,
  [Severity.Error]: 6,
  [Severity.Warning]: 3,
  [Severity.Info]: 1,
};
const DEFAULT_MULTIPLIERS: Readonly<Record<Severity, number>> = {
  [Severity.Critical]: 1,
  [Severity.Error]: 0.7,
  [Severity.Warning]: 0.35,
  [Severity.Info]: 0.1,
};

/** Calculates deterministic, explainable architecture health scores. */
export class ScoreEngine {
  /** Calculates a score from shared domain models and rule findings only. */
  public calculate(input: ScoreInput, configuration: ScoreConfiguration = {}): ArchitectureScore {
    const deduplicated = deduplicateFindings(input.findings);
    const normalization = sizeNormalization(input.metrics.totalFiles);
    const deductions = createDeductions(deduplicated.findings, configuration, normalization);
    const categories = createCategoryScores(deductions, configuration);
    const overall = round(
      categories.reduce((total, category) => total + (category.score * category.weight) / 100, 0),
    );
    const grade = calculateGrade(overall);

    return {
      breakdown: {
        deductions,
        strengths: categories
          .filter((category) => category.score >= 90)
          .map((category) => `${category.category} is healthy.`),
        weaknesses: categories
          .filter((category) => category.score < 75)
          .map((category) => `${category.category} needs attention.`),
      },
      categories,
      grade,
      metadata: {
        confidence: createConfidence(input.model.parseErrors.length, input.metrics.totalFiles),
        criticalFindings: deduplicated.findings.filter(
          (finding) => finding.severity === Severity.Critical,
        ).length,
        duplicateFindingsIgnored: deduplicated.duplicatesIgnored,
        errorFindings: deduplicated.findings.filter(
          (finding) => finding.severity === Severity.Error,
        ).length,
        normalizedFindingCount: round(deduplicated.findings.length / normalization),
        warningFindings: deduplicated.findings.filter(
          (finding) => finding.severity === Severity.Warning,
        ).length,
      },
      overall,
    };
  }
}

/** Converts a numeric score into Arcovia's stable letter grade. */
export function calculateGrade(score: number): ScoreGrade {
  if (score >= 97) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "B+";
  if (score >= 75) return "B";
  if (score >= 65) return "C+";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function createDeductions(
  findings: readonly Finding[],
  configuration: ScoreConfiguration,
  normalization: number,
): readonly ScoreDeduction[] {
  const grouped = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = `${finding.ruleId}:${finding.category}`;
    grouped.set(key, [...(grouped.get(key) ?? []), finding]);
  }
  const cap = configuration.maxPenaltyPerRule ?? 10;
  return [...grouped.values()]
    .map((ruleFindings) => {
      const first = ruleFindings[0];
      if (first === undefined) return undefined;
      const penalty = Math.min(
        cap,
        ruleFindings.reduce((total, finding) => total + findingPenalty(finding, configuration), 0) /
          normalization,
      );
      return {
        category: first.category,
        findingCount: ruleFindings.length,
        penalty: round(penalty),
        reason: first.title,
        ruleId: first.ruleId,
      };
    })
    .filter((deduction): deduction is ScoreDeduction => deduction !== undefined)
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

function createCategoryScores(
  deductions: readonly ScoreDeduction[],
  configuration: ScoreConfiguration,
): readonly CategoryScore[] {
  const weights = normalizeWeights(configuration.categoryWeights);
  return CATEGORIES.map((category) => {
    const penalty = deductions
      .filter((deduction) => deduction.category === category)
      .reduce((total, deduction) => total + deduction.penalty, 0);
    return {
      category,
      penalty: round(penalty),
      score: round(clamp(100 - penalty, 0, 100)),
      weight: weights[category],
    };
  });
}

function findingPenalty(finding: Finding, configuration: ScoreConfiguration): number {
  const penalties = { ...DEFAULT_PENALTIES, ...configuration.severityPenalties };
  const multipliers = { ...DEFAULT_MULTIPLIERS, ...configuration.severityMultipliers };
  return penalties[finding.severity] * multipliers[finding.severity];
}

function normalizeWeights(
  overrides: ScoreConfiguration["categoryWeights"],
): Readonly<Record<ScoreCategory, number>> {
  const weights = { ...DEFAULT_WEIGHTS, ...overrides };
  const total = CATEGORIES.reduce((sum, category) => sum + Math.max(0, weights[category]), 0);
  return Object.fromEntries(
    CATEGORIES.map((category) => [category, (Math.max(0, weights[category]) / total) * 100]),
  ) as Record<ScoreCategory, number>;
}

function deduplicateFindings(findings: readonly Finding[]): {
  readonly findings: readonly Finding[];
  readonly duplicatesIgnored: number;
} {
  const unique = new Map<string, Finding>();
  for (const finding of findings) {
    const key = `${finding.ruleId}:${finding.location.file}:${finding.location.line}:${finding.description}`;
    if (!unique.has(key)) unique.set(key, finding);
  }
  return { duplicatesIgnored: findings.length - unique.size, findings: [...unique.values()] };
}

function sizeNormalization(totalFiles: number): number {
  return Math.max(1, Math.sqrt(Math.max(1, totalFiles) / 100));
}

function createConfidence(
  parseErrors: number,
  totalFiles: number,
): { readonly reason: string; readonly value: number } {
  const value = clamp(100 - parseErrors * 5, 0, 100);
  return {
    reason:
      parseErrors === 0
        ? `Complete parser coverage across ${totalFiles} files.`
        : `${parseErrors} parser errors reduced confidence.`,
    value,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
