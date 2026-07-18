import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { build } from "vite";

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

function resolveAppEntry(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return currentFile.includes("/dist/")
    ? fileURLToPath(new URL("../src/reporters/html/app/main.tsx", import.meta.url))
    : fileURLToPath(new URL("./app/main.tsx", import.meta.url));
}

/** Bundles the React application and embeds it with sanitized analysis data in one offline HTML file. */
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
    const output = await build({
      appType: "custom",
      build: {
        cssCodeSplit: false,
        lib: { entry: resolveAppEntry(), formats: ["iife"], name: "ArcoviaHtmlReport" },
        minify: "esbuild",
        rollupOptions: { output: { inlineDynamicImports: true } },
        write: false,
      },
      configFile: false,
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      esbuild: { jsx: "automatic", jsxDev: false },
      logLevel: "silent",
      mode: "production",
    });
    const outputs = Array.isArray(output) ? output : [output];
    const bundle = [];
    for (const item of outputs) {
      if (!("output" in item)) {
        throw new Error("Arcovia HTML report build unexpectedly started a watcher.");
      }
      bundle.push(...item.output);
    }
    const script = bundle.find((item) => item.type === "chunk" && item.isEntry);
    const stylesheet = bundle.find(
      (item) => item.type === "asset" && item.fileName.endsWith(".css"),
    );
    if (script?.type !== "chunk" || stylesheet?.type !== "asset") {
      throw new Error(
        "Arcovia HTML report build did not produce a JavaScript bundle and stylesheet.",
      );
    }
    const css =
      typeof stylesheet.source === "string" ? stylesheet.source : stylesheet.source.toString();
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
  <title>Arcovia · ${escapeHtml(artifact.project.name)}</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script>window.__ARCOVIA_ANALYSIS__=${escapeJsonForScript(artifact)};</script>
  <script>${script.code}</script>
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
