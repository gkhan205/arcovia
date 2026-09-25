import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { AnalysisReport } from "../../domain/index.js";
import {
  type AnalysisBenchmarkProfile,
  type AnalysisJsonHistoryPoint,
  createAnalysisJson,
} from "../analysis-json/index.js";

/** Runtime metadata embedded into a self-contained HTML report. */
export interface HtmlReporterOptions {
  readonly benchmark?: AnalysisBenchmarkProfile;
  readonly cliVersion?: string;
  readonly engineVersion?: string;
  readonly history?: readonly AnalysisJsonHistoryPoint[];
  readonly nodeVersion?: string;
  readonly os?: string;
  readonly platform?: string;
}

function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

/** Detects whether the reporter is running from the compiled package on any supported OS. */
export function isBuiltReportModulePath(path: string): boolean {
  return path.replaceAll("\\", "/").includes("/dist/");
}

function resolveReportAsset(name: "app.css" | "app.js"): string {
  const currentFile = fileURLToPath(import.meta.url);
  return isBuiltReportModulePath(currentFile)
    ? fileURLToPath(new URL(`./report/${name}`, import.meta.url))
    : fileURLToPath(new URL(`../../../dist/report/${name}`, import.meta.url));
}

function resolveBrandAsset(name: "icon.png" | "logo.png"): string {
  const currentFile = fileURLToPath(import.meta.url);
  return isBuiltReportModulePath(currentFile)
    ? fileURLToPath(new URL(`../assets/${name}`, import.meta.url))
    : fileURLToPath(new URL(`../../../assets/${name}`, import.meta.url));
}

async function toPngDataUrl(name: "icon.png" | "logo.png"): Promise<string> {
  const image = await readFile(resolveBrandAsset(name));
  return `data:image/png;base64,${image.toString("base64")}`;
}

/** Embeds the prebuilt React application with sanitized analysis data in one offline HTML file. */
export class HtmlReporter {
  public async render(report: AnalysisReport, options: HtmlReporterOptions = {}): Promise<string> {
    const artifact = createAnalysisJson(report, {
      ...(options.benchmark === undefined ? {} : { benchmark: options.benchmark }),
      cliVersion: options.cliVersion ?? report.version,
      engineVersion: options.engineVersion ?? report.version,
      ...(options.history === undefined ? {} : { history: options.history }),
      nodeVersion: options.nodeVersion ?? report.metadata.nodeVersion,
      os: options.os ?? "unknown",
      platform: options.platform ?? "unknown",
    });
    const [css, script] = await Promise.all([
      readFile(resolveReportAsset("app.css"), "utf8"),
      readFile(resolveReportAsset("app.js"), "utf8"),
    ]);
    const [icon, logo] = await Promise.all([toPngDataUrl("icon.png"), toPngDataUrl("logo.png")]);
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
  <title>Arcovia · ${escapeHtml(artifact.project.name)}</title>
  <link rel="icon" type="image/png" href="${icon}">
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script>window.__ARCOVIA_ANALYSIS__=${escapeJsonForScript(artifact)};</script>
  <script>window.__ARCOVIA_BRAND__=${escapeJsonForScript({ logo })};</script>
  <script>${script}</script>
</body>
</html>`;
  }

  /** Generates and writes a complete, portable report.html document. */
  public async write(
    outputPath: string,
    report: AnalysisReport,
    options: HtmlReporterOptions = {},
  ): Promise<void> {
    await writeFile(outputPath, await this.render(report, options), "utf8");
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
