import type { AnalysisBenchmarkProfile } from "./analysis-json.js";

/** Validates a portable empirical benchmark profile before it is applied to a report. */
export function parseAnalysisBenchmarkProfile(value: unknown): AnalysisBenchmarkProfile {
  if (!isRecord(value) || !isRecord(value.score)) {
    throw new TypeError("Benchmark profile must include a score distribution.");
  }
  const { cohort, framework, sampleSize, score, version } = value;
  if (typeof cohort !== "string" || cohort.trim().length === 0) {
    throw new TypeError("Benchmark profile cohort must be a non-empty string.");
  }
  if (framework !== undefined && (typeof framework !== "string" || framework.trim().length === 0)) {
    throw new TypeError("Benchmark profile framework must be a non-empty string when supplied.");
  }
  if (typeof sampleSize !== "number" || !Number.isInteger(sampleSize) || sampleSize < 1) {
    throw new TypeError("Benchmark profile sampleSize must be a positive integer.");
  }
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new TypeError("Benchmark profile version must be a non-empty string.");
  }
  if (!isScoreDistribution(score)) {
    throw new TypeError(
      "Benchmark score percentiles must be numbers from 0 to 100 in ascending order.",
    );
  }
  return {
    cohort: cohort.trim(),
    ...(framework === undefined ? {} : { framework: framework.trim() }),
    sampleSize,
    score: { p25: score.p25, p50: score.p50, p75: score.p75 },
    version: version.trim(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isScoreDistribution(
  score: Record<string, unknown>,
): score is { readonly p25: number; readonly p50: number; readonly p75: number } {
  const values = [score.p25, score.p50, score.p75];
  return (
    values.every(
      (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100,
    ) &&
    (score.p25 as number) <= (score.p50 as number) &&
    (score.p50 as number) <= (score.p75 as number)
  );
}
