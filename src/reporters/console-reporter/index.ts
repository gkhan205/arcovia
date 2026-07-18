export type { ConsoleReporterOptions, ConsoleReportOutput } from "./console-reporter.js";
export { ConsoleReporter } from "./console-reporter.js";
export {
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
export type { ConsoleTheme } from "./theme.js";
export { createConsoleTheme, styleSeverity } from "./theme.js";
