import type { AnalysisReport } from "../../domain/index.js";
import { Severity } from "../../domain/index.js";
import { serializeAnalysisJson } from "../analysis-json/index.js";

import { renderParserErrors, sortFindings } from "./sections.js";
import { createConsoleTheme } from "./theme.js";

/** Presentation settings for the Console Reporter. */
export interface ConsoleReporterOptions {
  readonly ci?: boolean;
  readonly cliVersion?: string;
  readonly colors?: boolean;
  readonly compact?: boolean;
  readonly json?: boolean;
  readonly htmlReportPath?: string;
  readonly openReport?: boolean;
  readonly outputFiles?: readonly string[];
  readonly showRecommendations?: boolean;
  readonly showTiming?: boolean;
  readonly unicode?: boolean;
  readonly verbose?: boolean;
}

/** Stream payload produced by the presentation-only reporter. */
export interface ConsoleReportOutput {
  readonly stderr: string;
  readonly stdout: string;
}

const DEFAULT_TOP_FINDINGS = 3;

/** Renders an immutable analysis report without scanning, scoring, or writing files. */
export class ConsoleReporter {
  public render(report: AnalysisReport, options: ConsoleReporterOptions = {}): ConsoleReportOutput {
    if (options.json) {
      return {
        stderr: "",
        stdout: serializeAnalysisJson(report, {
          cliVersion: options.cliVersion ?? report.version,
          engineVersion: report.version,
          nodeVersion: report.metadata.nodeVersion,
          os: "unknown",
          platform: "unknown",
        }),
      };
    }

    const theme = createConsoleTheme(
      options.ci ? false : (options.colors ?? true),
      options.unicode ?? true,
    );
    if (options.compact) return { stderr: "", stdout: this.renderCompact(report, theme) };

    const parserErrors = renderParserErrors(report);
    return {
      stderr: parserErrors ? `${parserErrors}\n` : "",
      stdout: `${this.renderFull(report, options.cliVersion ?? report.version, theme, options)}\n`,
    };
  }

  private renderFull(
    report: AnalysisReport,
    cliVersion: string,
    theme: ReturnType<typeof createConsoleTheme>,
    options: ConsoleReporterOptions,
  ): string {
    const count = (severity: Severity) =>
      report.findings.filter((finding) => finding.severity === severity).length;
    const issues = sortFindings(report.findings)
      .filter((finding) => finding.severity !== Severity.Info)
      .slice(0, DEFAULT_TOP_FINDINGS);
    const divider = "─".repeat(46);
    const framework = report.project.framework === "next" ? "Next.js" : "React";
    const health =
      report.score.overall >= 90
        ? "Excellent Architecture"
        : report.score.overall >= 80
          ? "Strong Architecture"
          : report.score.overall >= 70
            ? "Architecture Needs Attention"
            : "Architecture Needs Work";
    const topPriorities =
      issues.length === 0
        ? ["No critical, error, or warning findings."]
        : issues.flatMap((finding, index) => [
            `• ${actionableFindingTitle(finding.title)}`,
            `  ↳ ${finding.location.file}`,
            ...(index === issues.length - 1 ? [] : [""]),
          ]);
    const reports = [
      ...(options.htmlReportPath === undefined ? [] : [`Report         ${options.htmlReportPath}`]),
      ...(options.htmlReportPath === undefined
        ? []
        : [
            "",
            options.openReport
              ? `${theme.symbols.success} Opening HTML report in your default browser...`
              : "Click the HTML report to open it in your browser.",
          ]),
    ];
    const reportSection = reports.length === 0 ? [] : ["", ...reports];

    return [
      divider,
      `🦉 Arcovia v${cliVersion}`,
      "Architecture Intelligence for React & Next.js",
      divider,
      "",
      "Project",
      `Framework     ${framework}`,
      `Files         ${report.project.metadata.sourceFiles}`,
      `Modules       ${report.model.modules.length}`,
      "",
      "Architecture",
      `Score          ${report.score.overall.toFixed(2)} / 100`,
      `Grade          ${report.score.grade}`,
      `Status         ${health}`,
      "",
      "Summary",
      ...wrapText(createSummary(report), 62),
      "",
      "Findings",
      `Total          ${report.findings.length}`,
      `Critical       ${count(Severity.Critical)}`,
      `Warnings       ${count(Severity.Warning)}`,
      `Info           ${count(Severity.Info)}`,
      "",
      "Top Priorities",
      ...topPriorities,
      ...reportSection,
    ].join("\n");
  }

  private renderCompact(
    report: AnalysisReport,
    theme: ReturnType<typeof createConsoleTheme>,
  ): string {
    const critical = report.findings.filter((finding) => finding.severity === "critical").length;
    const warnings = report.findings.filter((finding) => finding.severity === "warning").length;
    return [
      `${theme.symbols.failure} ${report.findings.length} findings`,
      `Score: ${report.score.overall}`,
      `Critical: ${critical}`,
      `Warnings: ${warnings}`,
      "",
    ].join("\n");
  }
}

function actionableFindingTitle(title: string): string {
  return title === "JSX nesting is too deep" ? "Reduce JSX nesting" : title;
}

function createSummary(report: AnalysisReport): string {
  if (report.score.overall >= 85) {
    return "Well-structured project with opportunities to simplify component complexity and improve maintainability.";
  }
  if (report.score.overall >= 70) {
    return "Solid architectural foundation with opportunities to reduce complexity and improve maintainability.";
  }
  return report.score.breakdown.summary;
}

function wrapText(value: string, width: number): readonly string[] {
  const words = value.split(/\s+/u);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line.length === 0 ? word : `${line} ${word}`;
    if (next.length > width && line.length > 0) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}
