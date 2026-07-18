import type { Finding } from "../domain/index.js";

import type { RuleExecutionResult } from "./rule-executor.js";

/** Normalizes, deduplicates, sorts, and freezes rule findings. */
export class FindingCollector {
  /** Collects valid findings from completed rules. */
  public collect(results: readonly RuleExecutionResult[]): readonly Finding[] {
    const candidates = results
      .filter((result) => result.status === "completed")
      .flatMap((result) =>
        result.findings
          .filter((finding) => isValidFinding(finding, result.scheduledRule.rule.id))
          .map((finding) => ({ ...finding, severity: result.scheduledRule.severity })),
      )
      .sort(compareFindings);
    const findings = new Map<string, Finding>();
    for (const finding of candidates) {
      const key = findingKey(finding);
      if (!findings.has(key)) findings.set(key, finding);
    }
    return Object.freeze([...findings.values()]);
  }
}

function isValidFinding(finding: Finding, ruleId: string): boolean {
  return finding.ruleId === ruleId && finding.location.file.length > 0 && finding.location.line > 0;
}

function findingKey(finding: Finding): string {
  return `${finding.ruleId}:${finding.location.file}:${finding.location.line}:${finding.description}`;
}

function compareFindings(left: Finding, right: Finding): number {
  return (
    left.ruleId.localeCompare(right.ruleId) ||
    left.location.file.localeCompare(right.location.file) ||
    left.location.line - right.location.line ||
    left.description.localeCompare(right.description) ||
    left.id.localeCompare(right.id)
  );
}
