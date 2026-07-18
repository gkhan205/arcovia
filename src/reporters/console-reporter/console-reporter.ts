import type { AnalysisReport } from "../../domain/index.js";
import { serializeAnalysisJson } from "../analysis-json/index.js";

import {
  renderBanner,
  renderCategoryBreakdown,
  renderFindings,
  renderMetrics,
  renderOutputFiles,
  renderParserErrors,
  renderProject,
  renderRecommendations,
  renderScore,
  renderSummary,
  renderTiming,
  sortFindings,
} from "./sections.js";
import { createConsoleTheme } from "./theme.js";

/** Presentation settings for the Console Reporter. */
export interface ConsoleReporterOptions {
  readonly ci?: boolean;
  readonly cliVersion?: string;
  readonly colors?: boolean;
  readonly compact?: boolean;
  readonly json?: boolean;
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

const DEFAULT_TOP_FINDINGS = 5;

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

    const orderedFindings = sortFindings(report.findings);
    const findings = options.verbose
      ? orderedFindings
      : orderedFindings.slice(0, DEFAULT_TOP_FINDINGS);
    const sections = [
      renderBanner(report, options.cliVersion ?? report.version, theme),
      renderProject(report),
      renderScore(report.score, theme),
      renderSummary(report.findings, theme),
      renderFindings(findings, theme, options.verbose ?? false),
      ...(options.verbose ? [renderMetrics(report)] : []),
      renderCategoryBreakdown(report.score),
      ...(options.showRecommendations === false ? [] : [renderRecommendations(report.findings)]),
      ...(options.outputFiles === undefined || options.outputFiles.length === 0
        ? []
        : [renderOutputFiles(options.outputFiles)]),
      ...(options.showTiming === false ? [] : [renderTiming(report)]),
    ];
    const parserErrors = renderParserErrors(report);
    return {
      stderr: parserErrors ? `${parserErrors}\n` : "",
      stdout: `${sections.join("\n\n")}\n`,
    };
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
