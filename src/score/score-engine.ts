import {
  type ArchitectureGraph,
  type ArchitectureScore,
  type CategoryScore,
  type Finding,
  type MetricCollection,
  type Project,
  type ProjectModel,
  type ScoreCategory,
  type ScoreContributor,
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
  readonly criticalRiskAdjustments?: readonly number[];
  readonly maxPenaltyPerRule?: number;
  readonly rulePenaltyCaps?: Readonly<Record<string, number>>;
  readonly ruleWeights?: Readonly<Record<string, number>>;
  readonly severityMultipliers?: Readonly<Partial<Record<Severity, number>>>;
  readonly severityPenalties?: Readonly<Partial<Record<Severity, number>>>;
  /** Severity penalties applied only to user-configured architecture policy findings. */
  readonly policySeverityPenalties?: Readonly<Partial<Record<Severity, number>>>;
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
  [Severity.Critical]: 15,
  [Severity.Error]: 8,
  [Severity.Warning]: 1,
  [Severity.Info]: 0.1,
};
const DEFAULT_MULTIPLIERS: Readonly<Record<Severity, number>> = {
  [Severity.Critical]: 1,
  [Severity.Error]: 1,
  [Severity.Warning]: 1,
  [Severity.Info]: 1,
};

/** Relative architectural risk for built-in rules. Unlisted rules retain a neutral weight of 1. */
export const DEFAULT_RULE_RISK_WEIGHTS: Readonly<Record<string, number>> = {
  "no-circular-imports": 1.5,
  "god-module": 1.25,
  "high-fan-in": 1,
  "high-fan-out": 1,
  "deep-dependency-chain": 0.9,
  "large-component": 0.9,
  "deeply-nested-jsx": 0.7,
  "duplicate-imports": 0.35,
  "unused-export": 0.1,
};

const DEFAULT_RULE_PENALTY_CAPS: Readonly<Record<string, number>> = {
  "duplicate-imports": 2,
  "unused-export": 3,
};

/** The first few critical findings matter most; the total adjustment is intentionally bounded. */
const DEFAULT_CRITICAL_RISK_ADJUSTMENTS = [10, 8, 6, 4] as const;

/** Calculates deterministic, explainable architecture health scores. */
export class ScoreEngine {
  /** Calculates a score from shared domain models and rule findings only. */
  public calculate(input: ScoreInput, configuration: ScoreConfiguration = {}): ArchitectureScore {
    const deduplicated = deduplicateFindings(input.findings);
    const deductions = createDeductions(deduplicated.findings, configuration);
    const categories = createCategoryScores(deductions, configuration);
    const categoryWeightedScore = weightedCategoryScore(categories);
    const maintenanceBurden = calculateMaintenanceBurden(deduplicated.findings);
    const criticalRiskAdjustment = calculateCriticalRiskAdjustment(
      deduplicated.findings,
      configuration,
    );
    const overall = round(
      clamp(categoryWeightedScore - maintenanceBurden - criticalRiskAdjustment, 0, 100),
    );
    const grade = calculateGrade(overall);

    return {
      breakdown: {
        categoryWeightedScore,
        criticalRiskAdjustment,
        maintenanceBurden,
        contributors: createContributors(categories, maintenanceBurden, criticalRiskAdjustment),
        deductions,
        strengths: createStrengths(input, categories, deduplicated.findings),
        summary: createScoreSummary(
          input,
          categories,
          criticalRiskAdjustment,
          deduplicated.findings,
        ),
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
        normalizedFindingCount: round(
          deduplicated.findings.length / sizeNormalization(input.metrics.totalFiles),
        ),
        warningFindings: deduplicated.findings.filter(
          (finding) => finding.severity === Severity.Warning,
        ).length,
      },
      overall,
    };
  }
}

function createContributors(
  categories: readonly CategoryScore[],
  maintenanceBurden: number,
  criticalRiskAdjustment: number,
): readonly ScoreContributor[] {
  const categoryContributors = categories
    .filter((category) => category.penalty > 0)
    .map((category) => ({
      detail: `${category.score}/100 across its ${category.weight}% score weight.`,
      impact: round(category.penalty * (category.weight / 100)),
      label: `${capitalize(category.category)} category`,
      type: "category" as const,
    }));
  const contributors = [
    ...categoryContributors,
    ...(maintenanceBurden === 0
      ? []
      : [
          {
            detail: "Capped adjustment for the total volume of warning and informational debt.",
            impact: maintenanceBurden,
            label: "Maintenance burden",
            type: "maintenance-burden" as const,
          },
        ]),
    ...(criticalRiskAdjustment === 0
      ? []
      : [
          {
            detail: "Applied once after category health for verified critical findings.",
            impact: criticalRiskAdjustment,
            label: "Critical-risk adjustment",
            type: "critical-risk" as const,
          },
        ]),
  ];
  return contributors
    .filter((contributor) => contributor.impact > 0)
    .sort((left, right) => right.impact - left.impact || left.label.localeCompare(right.label));
}

function createStrengths(
  input: ScoreInput,
  categories: readonly CategoryScore[],
  findings: readonly Finding[],
): readonly string[] {
  const strengths: string[] = [];
  if (input.graph.cycles.length === 0) {
    strengths.push(
      `No circular module dependencies across ${input.graph.statistics.nodes} modules.`,
    );
  }
  if (!findings.some((finding) => finding.severity === Severity.Critical)) {
    strengths.push("No critical architecture findings were detected.");
  }
  const healthyCategories = categories.filter((category) => category.score >= 90).length;
  if (healthyCategories > 0) {
    strengths.push(
      `${healthyCategories} of ${categories.length} score categories are at or above 90.`,
    );
  }
  return strengths;
}

function createScoreSummary(
  input: ScoreInput,
  categories: readonly CategoryScore[],
  criticalRiskAdjustment: number,
  findings: readonly Finding[],
): string {
  const lowestCategory = [...categories].sort(
    (left, right) => left.score - right.score || left.category.localeCompare(right.category),
  )[0];
  if (findings.length === 0) {
    return `The project has ${input.graph.statistics.nodes} modules with no architecture risks detected.`;
  }
  const cycleStatement =
    input.graph.cycles.length === 0
      ? "no dependency cycles"
      : `${input.graph.cycles.length} dependency cycle(s)`;
  const strongestCategory = [...categories].sort(
    (left, right) => right.score - left.score || left.category.localeCompare(right.category),
  )[0];
  if (criticalRiskAdjustment > 0) {
    return `The project has ${input.graph.statistics.nodes} modules and ${cycleStatement}; ${findings.filter((finding) => finding.severity === Severity.Critical).length} critical finding(s) need attention, primarily in ${lowestCategory?.category ?? "architecture"}.`;
  }
  return `The project demonstrates a strong overall architecture across ${input.graph.statistics.nodes} modules with ${cycleStatement}. Most opportunities are concentrated in ${lowestCategory?.category ?? "architecture"}, while ${strongestCategory?.category ?? "other areas"} remains healthy.`;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function weightedCategoryScore(categories: readonly CategoryScore[]): number {
  return round(
    categories.reduce((total, category) => total + category.score * (category.weight / 100), 0),
  );
}

function calculateCriticalRiskAdjustment(
  findings: readonly Finding[],
  configuration: ScoreConfiguration,
): number {
  const adjustments = configuration.criticalRiskAdjustments ?? DEFAULT_CRITICAL_RISK_ADJUSTMENTS;
  return round(
    findings
      .filter((finding) => finding.severity === Severity.Critical)
      .reduce((total, _finding, index) => total + (adjustments[index] ?? 0), 0),
  );
}

function calculateMaintenanceBurden(findings: readonly Finding[]): number {
  const warnings = findings.filter((finding) => finding.severity === Severity.Warning).length;
  const infos = findings.filter((finding) => finding.severity === Severity.Info).length;
  const errors = findings.filter((finding) => finding.severity === Severity.Error).length;
  const warningBurden = Math.min(8, Math.sqrt(warnings) * 1.1);
  const infoBurden = Math.min(2, Math.sqrt(infos) * 0.08);
  const errorBurden = Math.min(6, errors * 1.5);
  return round(warningBurden + infoBurden + errorBurden);
}

/** Converts a numeric score into Arcovia's stable letter grade. */
export function calculateGrade(score: number): ScoreGrade {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
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
): readonly ScoreDeduction[] {
  const grouped = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = `${finding.ruleId}:${finding.category}`;
    grouped.set(key, [...(grouped.get(key) ?? []), finding]);
  }
  return [...grouped.values()]
    .map((ruleFindings) => {
      const first = ruleFindings[0];
      if (first === undefined) return undefined;
      const weight = ruleWeight(first.ruleId, configuration);
      const penalty = Math.min(
        rulePenaltyCap(first.ruleId, configuration),
        ruleFindings
          .slice()
          .sort(compareFindingsByRisk)
          .reduce(
            (total, finding, index) =>
              total + (findingPenalty(finding, configuration) * weight) / (index + 1),
            0,
          ),
      );
      return {
        category: first.category,
        findingCount: ruleFindings.length,
        penalty: round(penalty),
        reason: first.title,
        ruleId: first.ruleId,
        weight,
      };
    })
    .filter((deduction): deduction is ScoreDeduction => deduction !== undefined)
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

function compareFindingsByRisk(left: Finding, right: Finding): number {
  const severityRank: Readonly<Record<Severity, number>> = {
    [Severity.Critical]: 0,
    [Severity.Error]: 1,
    [Severity.Warning]: 2,
    [Severity.Info]: 3,
  };
  return (
    severityRank[left.severity] - severityRank[right.severity] || left.id.localeCompare(right.id)
  );
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
  if (
    finding.ruleId === "architecture-policy" &&
    configuration.policySeverityPenalties !== undefined
  ) {
    return configuration.policySeverityPenalties[finding.severity] ?? 0;
  }
  const penalties = { ...DEFAULT_PENALTIES, ...configuration.severityPenalties };
  const multipliers = { ...DEFAULT_MULTIPLIERS, ...configuration.severityMultipliers };
  return penalties[finding.severity] * multipliers[finding.severity];
}

function ruleWeight(ruleId: string, configuration: ScoreConfiguration): number {
  const weight = configuration.ruleWeights?.[ruleId] ?? DEFAULT_RULE_RISK_WEIGHTS[ruleId] ?? 1;
  return Math.max(0, weight);
}

function rulePenaltyCap(ruleId: string, configuration: ScoreConfiguration): number {
  const cap =
    configuration.rulePenaltyCaps?.[ruleId] ??
    DEFAULT_RULE_PENALTY_CAPS[ruleId] ??
    configuration.maxPenaltyPerRule ??
    30;
  return Math.max(0, cap);
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
