import { formatTable } from "../../cli/ui/table.js";
import type { AnalysisReport, ArchitectureScore, Finding } from "../../domain/index.js";
import { Severity } from "../../domain/index.js";

import type { ConsoleTheme } from "./theme.js";
import { styleSeverity } from "./theme.js";

const CATEGORY_ORDER = [
  "architecture",
  "imports",
  "components",
  "hooks",
  "context",
  "routes",
  "performance",
  "complexity",
] as const;
const SEVERITY_ORDER: Readonly<Record<Severity, number>> = {
  [Severity.Critical]: 0,
  [Severity.Error]: 1,
  [Severity.Warning]: 2,
  [Severity.Info]: 3,
};

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function divider(theme: ConsoleTheme): string {
  return theme.border.repeat(54);
}

function formatDuration(duration: number): string {
  return duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
}

/** Renders the versioned Arcovia product banner. */
export function renderBanner(
  report: AnalysisReport,
  cliVersion: string,
  theme: ConsoleTheme,
): string {
  return [
    divider(theme),
    "Arcovia",
    "Frontend Architecture Intelligence",
    "- by Ghazi Khan",
    `CLI ${cliVersion} · Engine ${report.version}`,
    divider(theme),
  ].join("\n");
}

/** Renders stable project facts without exposing filesystem paths. */
export function renderProject(report: AnalysisReport): string {
  return [
    "Project",
    formatTable(
      [
        { heading: "Field", key: "field" },
        { heading: "Value", key: "value" },
      ],
      [
        { field: "Project", value: report.project.name },
        { field: "Framework", value: report.project.framework },
        { field: "Package Manager", value: report.project.packageManager },
        { field: "Workspace", value: report.project.workspace },
        { field: "Files", value: String(report.project.metadata.sourceFiles) },
        { field: "Modules", value: String(report.model.modules.length) },
        { field: "Components", value: String(report.model.components.length) },
        { field: "Duration", value: formatDuration(report.metadata.duration) },
      ],
    ),
  ].join("\n");
}

/** Renders the score before any findings, emphasizing the primary health signal. */
export function renderScore(score: ArchitectureScore, theme: ConsoleTheme): string {
  const health =
    score.overall >= 75 ? theme.success("Healthy Architecture") : theme.warning("Needs Attention");
  return ["Architecture Score", `${score.overall} / 100`, `Grade: ${score.grade}`, health].join(
    "\n",
  );
}

/** Renders a severity-count overview that remains legible without color. */
export function renderSummary(findings: readonly Finding[], theme: ConsoleTheme): string {
  const count = (severity: Severity) =>
    findings.filter((finding) => finding.severity === severity).length;
  return [
    "Summary",
    `${styleSeverity(Severity.Critical, "CRITICAL", theme)}: ${count(Severity.Critical)}`,
    `${styleSeverity(Severity.Error, "ERRORS", theme)}: ${count(Severity.Error)}`,
    `${styleSeverity(Severity.Warning, "WARNINGS", theme)}: ${count(Severity.Warning)}`,
    `${styleSeverity(Severity.Info, "INFO", theme)}: ${count(Severity.Info)}`,
    `Total Findings: ${findings.length}`,
  ].join("\n");
}

/** Applies the public severity, rule, file, and line ordering contract. */
export function sortFindings(findings: readonly Finding[]): readonly Finding[] {
  return [...findings].sort(
    (left, right) =>
      SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
      compareText(left.ruleId, right.ruleId) ||
      compareText(left.location.file, right.location.file) ||
      left.location.line - right.location.line ||
      left.location.column - right.location.column ||
      compareText(left.id, right.id),
  );
}

/** Renders one or more findings, adding evidence only for verbose reports. */
export function renderFindings(
  findings: readonly Finding[],
  theme: ConsoleTheme,
  verbose: boolean,
): string {
  const rendered = findings.map((finding) => {
    const details = [
      `[${styleSeverity(finding.severity, finding.severity.toUpperCase(), theme)}]`,
      finding.title,
      `Rule: ${finding.ruleId}`,
      `File: ${finding.location.file}`,
      `Line: ${finding.location.line}`,
      `Recommendation: ${finding.recommendation}`,
    ];
    if (verbose) {
      details.splice(
        2,
        0,
        `Description: ${finding.description}`,
        `Rationale: ${finding.rationale}`,
      );
      details.push(
        `Evidence: ${
          finding.evidence.length === 0
            ? "None"
            : finding.evidence
                .map((evidence) => `${evidence.metric}=${String(evidence.value)}`)
                .join(", ")
        }`,
      );
    }
    return details.join("\n");
  });
  return ["Top Findings", ...rendered].join("\n\n");
}

/** Renders aggregate measurements for verbose reports without exposing parser internals. */
export function renderMetrics(report: AnalysisReport): string {
  return [
    "Metrics",
    formatTable(
      [
        { heading: "Metric", key: "metric" },
        { heading: "Value", key: "value" },
      ],
      [
        { metric: "Imports", value: String(report.metrics.imports) },
        { metric: "Exports", value: String(report.metrics.exports) },
        { metric: "Dependencies", value: String(report.metrics.dependencies) },
        { metric: "Hooks", value: String(report.metrics.hooks) },
        { metric: "Contexts", value: String(report.metrics.contexts) },
        { metric: "Routes", value: String(report.model.routes.length) },
      ],
    ),
  ].join("\n");
}

/** Renders category scores in a priority order independent of input order. */
export function renderCategoryBreakdown(score: ArchitectureScore): string {
  const priority = new Map(CATEGORY_ORDER.map((category, index) => [category, index]));
  const rows = [...score.categories]
    .sort(
      (left, right) =>
        (priority.get(left.category) ?? Number.MAX_SAFE_INTEGER) -
          (priority.get(right.category) ?? Number.MAX_SAFE_INTEGER) ||
        compareText(left.category, right.category),
    )
    .map((category) => ({ category: category.category, score: String(category.score) }));
  return [
    "Category Breakdown",
    formatTable(
      [
        { heading: "Category", key: "category" },
        { heading: "Score", key: "score" },
      ],
      rows,
    ),
  ].join("\n");
}

/** Renders the first three distinct, highest-priority recommendations. */
export function renderRecommendations(findings: readonly Finding[]): string {
  const recommendations = [
    ...new Set(sortFindings(findings).map((finding) => finding.recommendation)),
  ].slice(0, 3);
  return [
    "Recommendations",
    ...recommendations.map((recommendation, index) => `${index + 1}. ${recommendation}`),
  ].join("\n");
}

/** Renders output file names supplied by the caller, if any. */
export function renderOutputFiles(outputFiles: readonly string[]): string {
  return ["Generated", ...[...outputFiles].sort(compareText)].join("\n");
}

/** Renders report-level timing available at this stage of the pipeline. */
export function renderTiming(report: AnalysisReport): string {
  return ["Execution Statistics", `Total: ${formatDuration(report.metadata.duration)}`].join("\n");
}

/** Renders recoverable parser diagnostics as friendly stderr messages. */
export function renderParserErrors(report: AnalysisReport): string {
  return [...report.model.parseErrors]
    .sort(
      (left, right) =>
        compareText(left.fileId, right.fileId) ||
        left.line - right.line ||
        left.column - right.column ||
        compareText(left.message, right.message),
    )
    .map((error) =>
      [
        "Parser Error",
        `Unable to parse ${error.fileId}:${error.line}`,
        `Reason: ${error.message}`,
      ].join("\n"),
    )
    .join("\n\n");
}
