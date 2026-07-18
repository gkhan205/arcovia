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
  readonly outputFiles?: readonly string[];
  readonly reportUrl?: string;
  readonly showRecommendations?: boolean;
  readonly showTiming?: boolean;
  readonly showOpenCommand?: boolean;
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
    const divider = "─".repeat(63);
    const framework = report.project.framework === "next" ? "Next.js" : "React";
    const health =
      report.score.overall >= 90
        ? "Excellent Architecture"
        : report.score.overall >= 80
          ? "Strong Architecture"
          : report.score.overall >= 70
            ? "Architecture Needs Attention"
            : "Architecture Needs Work";
    const topIssues =
      issues.length === 0
        ? ["No critical, error, or warning findings."]
        : issues.flatMap((finding) => [
            `${finding.severity === Severity.Warning ? theme.symbols.warning : theme.symbols.failure} ${finding.title}`,
            `  ${finding.location.file}`,
            "",
          ]);
    const reportLink =
      options.reportUrl === undefined
        ? []
        : [
            "Full interactive report",
            "",
            options.reportUrl,
            ...(options.showOpenCommand
              ? ["", "Open automatically", "", "arcovia analyze . --open"]
              : []),
          ];

    return [
      "╭──────────────────────────────────────────────────────────────╮",
      "│                                                              │",
      `│   🦉 Arcovia v${cliVersion.padEnd(46)}│`,
      "│   Architecture Intelligence for React Teams                  │",
      "│                                                              │",
      "╰──────────────────────────────────────────────────────────────╯",
      "",
      "Project",
      divider,
      `Name          ${report.project.name}`,
      `Framework     ${framework}`,
      `Files         ${report.project.metadata.sourceFiles}`,
      `Modules       ${report.model.modules.length}`,
      "",
      "Architecture Health",
      divider,
      "",
      `        ${report.score.overall.toFixed(2)} / 100      Grade ${report.score.grade}`,
      "",
      `        ${health}`,
      "",
      "Summary",
      divider,
      `Findings       ${report.findings.length}`,
      `Warnings       ${count(Severity.Warning)}`,
      `Errors         ${count(Severity.Error)}`,
      `Critical       ${count(Severity.Critical)}`,
      "",
      "Top Issues",
      divider,
      ...topIssues,
      ...reportLink,
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
