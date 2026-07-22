import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";

import { loadConfiguration, loadPolicyConfiguration } from "../config/index.js";
import { AnalysisBuilder, CoreEngine, ReporterPipeline } from "../core/index.js";
import { ArchitectureGraphBuilder } from "../graph/index.js";
import { ProjectParser } from "../parser/index.js";
import { PolicyEngine } from "../policies/index.js";
import { ConsoleReporter, HtmlReporter, JsonReporter } from "../reporters/index.js";
import { RuleEngine, RuleRegistry, registerInitialRules } from "../rules/index.js";
import { ProjectScanner } from "../scanner/index.js";
import { ScoreEngine } from "../score/index.js";
import { Logger } from "../shared/index.js";

import type { CliDependencies } from "./dependencies.js";
import type { AnalysisReport, AnalyzeProjectInput, CommandRunner } from "./services/index.js";
import { OraSpinner } from "./ui/index.js";

const executeFile = promisify(execFile);

declare const __ARCOVIA_VERSION__: string | undefined;

const ARCOVIA_VERSION = typeof __ARCOVIA_VERSION__ === "string" ? __ARCOVIA_VERSION__ : "0.1.0-dev";

class CoreCommandRunner implements CommandRunner {
  public constructor(
    private readonly engine: CoreEngine,
    private readonly pipeline: ReporterPipeline,
    private readonly logger: Logger,
  ) {}

  public async analyze(input: AnalyzeProjectInput): Promise<AnalysisReport> {
    const result = await this.engine.analyze({
      logger: this.logger,
      policyConfiguration: await loadPolicyConfiguration(input.projectPath),
      projectPath: input.projectPath,
    });
    await this.pipeline.execute(result.report, {
      ...(input.benchmark === undefined ? {} : { benchmark: input.benchmark }),
      console: false,
      html: input.generateHtml,
      json: input.generateJson,
      ...(input.outputPath === undefined ? {} : { outputDirectory: input.outputPath }),
    });
    return result.report;
  }
}

/** Creates the runtime dependencies used by the executable CLI. */
export function createDefaultDependencies(): CliDependencies {
  const configuration = loadConfiguration();
  const logger = new Logger({ level: configuration.debug ? "DEBUG" : "INFO" });
  const registry = new RuleRegistry();
  registerInitialRules(registry);
  const engine = new CoreEngine({
    analysisBuilder: new AnalysisBuilder({
      nodeVersion: process.version,
      version: ARCOVIA_VERSION,
    }),
    graphBuilder: new ArchitectureGraphBuilder(),
    parser: new ProjectParser(),
    policyEngine: new PolicyEngine(),
    ruleConfiguration: { rules: {} },
    ruleEngine: new RuleEngine(registry),
    scanner: new ProjectScanner(logger),
    scoreEngine: new ScoreEngine(),
  });
  const pipeline = new ReporterPipeline({
    consoleReporter: new ConsoleReporter(),
    htmlReporter: new HtmlReporter(),
    jsonReporter: new JsonReporter(),
    output: {
      writeError: (message) => process.stderr.write(message),
      writeOutput: (message) => process.stdout.write(message),
    },
  });

  return {
    commandRunner: new CoreCommandRunner(engine, pipeline, logger),
    configuration,
    createSpinner: () => new OraSpinner(),
    currentDirectory: () => process.cwd(),
    fileSystem: { stat },
    logger,
    openReport: async (url) => {
      const [command, argumentsList] =
        process.platform === "darwin"
          ? ["open", [url]]
          : process.platform === "win32"
            ? ["cmd", ["/c", "start", "", url]]
            : ["xdg-open", [url]];
      await executeFile(command, argumentsList, { windowsHide: true });
    },
    standardError: process.stderr,
    standardOutput: process.stdout,
    version: ARCOVIA_VERSION,
  };
}
