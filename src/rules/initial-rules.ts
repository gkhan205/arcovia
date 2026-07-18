import { createHash } from "node:crypto";
import { posix } from "node:path";

import { type Finding, type FindingEvidence, FrameworkType, Severity } from "../domain/index.js";

import type { Rule, RuleContext } from "./rule.js";
import type { RuleRegistry } from "./rule-registry.js";

/** Registers the high-confidence initial architecture rules supported by the MVP model. */
export function registerInitialRules(registry: RuleRegistry): void {
  for (const rule of INITIAL_RULES) registry.register(rule);
}

/** Initial deterministic rules that require no filesystem or AST access. */
export const INITIAL_RULES: readonly Rule[] = [
  createRule(
    "no-circular-imports",
    "Circular imports",
    "imports",
    Severity.Critical,
    (context, rule) =>
      context.graph.cycles.map((cycle) => {
        const nodes = cycle.nodes
          .map((id) => context.graph.nodes.find((node) => node.id === id))
          .filter((node): node is NonNullable<typeof node> => node !== undefined);
        const paths = nodes.map((node) => node.path);
        const cyclePaths = paths.length > 0 ? [...paths, paths[0] ?? ""] : [];
        return finding(
          rule,
          context,
          nodes[0] === undefined ? undefined : fileIdFromNode(nodes[0]),
          1,
          "Circular module dependency",
          cyclePaths.length > 0
            ? `Circular dependency: ${cyclePaths.join(" → ")}.`
            : "A circular dependency was detected.",
          "Cycles make module initialization order and refactoring harder.",
          "Extract shared logic into a separate module.",
          [
            evidence("cycleLength", cycle.length),
            evidence("cycleNodes", cycle.nodes),
            evidence("cyclePaths", cyclePaths),
          ],
        );
      }),
  ),
  createRule(
    "deep-dependency-chain",
    "Deep dependency chain",
    "imports",
    Severity.Warning,
    (context, rule) => {
      const maxDepth = threshold(context, rule.id, "maxDepth", 10);
      return context.graph.statistics.maxDepth > maxDepth
        ? [
            finding(
              rule,
              context,
              undefined,
              1,
              "Dependency chain is too deep",
              `The maximum dependency depth is ${context.graph.statistics.maxDepth}.`,
              "Long chains increase coupling across layers.",
              "Flatten the dependency hierarchy or extract an explicit boundary.",
              [
                evidence("maxDepth", context.graph.statistics.maxDepth),
                evidence("threshold", maxDepth),
              ],
            ),
          ]
        : [];
    },
  ),
  createRule(
    "duplicate-imports",
    "Duplicate imports",
    "imports",
    Severity.Warning,
    (context, rule) => {
      const grouped = new Map<string, number>();
      for (const entry of context.model.imports) {
        const key = `${entry.fileId}:${entry.source}`;
        grouped.set(key, (grouped.get(key) ?? 0) + 1);
      }
      return [...grouped].flatMap(([key, count]) => {
        if (count < 2) return [];
        const [fileId, source] = key.split(":", 2);
        return [
          finding(
            rule,
            context,
            fileId,
            1,
            "Duplicate import declarations",
            `The module imports ${source ?? "the same target"} ${count} times.`,
            "Repeated import declarations obscure a module's dependencies.",
            "Merge imports from the same source into one declaration.",
            [evidence("importCount", count)],
          ),
        ];
      });
    },
  ),
  createRule(
    "barrel-file-overuse",
    "Large barrel file",
    "imports",
    Severity.Warning,
    (context, rule) =>
      context.model.modules.flatMap((module) => {
        const maximum = threshold(context, rule.id, "maxExports", 30);
        return posix.basename(module.path).startsWith("index.") && module.exports.length > maximum
          ? [
              finding(
                rule,
                context,
                module.fileId,
                1,
                "Barrel file has too many exports",
                `${module.path} exports ${module.exports.length} symbols.`,
                "Large barrels hide ownership and make dependencies less explicit.",
                "Split exports into domain-specific entry points.",
                [evidence("exports", module.exports.length), evidence("threshold", maximum)],
              ),
            ]
          : [];
      }),
  ),
  createRule("unused-export", "Unused export", "imports", Severity.Info, (context, rule) => {
    const importedNames = new Set(context.model.imports.flatMap((entry) => entry.specifiers));
    return context.model.exports.flatMap((entry) =>
      !isFrameworkManagedExport(context, entry.fileId) &&
      !entry.isDefault &&
      entry.name !== "default" &&
      entry.name !== "*" &&
      !importedNames.has(entry.name)
        ? [
            finding(
              rule,
              context,
              entry.fileId,
              entry.line,
              "Export has no internal usage",
              `${entry.name} is not imported by another scanned module.`,
              "Unused exports enlarge public module APIs and increase maintenance cost.",
              "Remove the export or document its external consumer.",
              [evidence("export", entry.name)],
            ),
          ]
        : [],
    );
  }),
  createRule(
    "large-component",
    "Large component",
    "components",
    Severity.Warning,
    (context, rule) =>
      context.model.components.flatMap((component) => {
        const maximum = threshold(context, rule.id, "maxLines", 300);
        return component.lineCount > maximum
          ? [
              finding(
                rule,
                context,
                component.fileId,
                1,
                "Component exceeds recommended size",
                `${component.name} has ${component.lineCount} logical lines.`,
                "Large components tend to own too many responsibilities.",
                "Split the component into focused child components or hooks.",
                [evidence("linesOfCode", component.lineCount), evidence("threshold", maximum)],
              ),
            ]
          : [];
      }),
  ),
  createRule(
    "excessive-props",
    "Excessive props",
    "components",
    Severity.Warning,
    (context, rule) =>
      context.model.components.flatMap((component) => {
        const maximum = threshold(context, rule.id, "maxProps", 10);
        return component.props.length > maximum
          ? [
              finding(
                rule,
                context,
                component.fileId,
                1,
                "Component has too many props",
                `${component.name} declares ${component.props.length} props.`,
                "Large component APIs are hard to understand and evolve.",
                "Group related props, use composition, or introduce context.",
                [evidence("props", component.props.length), evidence("threshold", maximum)],
              ),
            ]
          : [];
      }),
  ),
  createRule(
    "deeply-nested-jsx",
    "Deeply nested JSX",
    "components",
    Severity.Warning,
    (context, rule) =>
      context.model.components.flatMap((component) => {
        const maximum = threshold(context, rule.id, "maxDepth", 8);
        return component.jsxDepth > maximum
          ? [
              finding(
                rule,
                context,
                component.fileId,
                1,
                "JSX nesting is too deep",
                `${component.name} has JSX depth ${component.jsxDepth}.`,
                "Deep trees are difficult to read and test.",
                "Extract intermediate components to flatten the JSX structure.",
                [evidence("jsxDepth", component.jsxDepth), evidence("threshold", maximum)],
              ),
            ]
          : [];
      }),
  ),
  createRule("too-many-hooks", "Too many hooks", "hooks", Severity.Warning, (context, rule) =>
    context.model.components.flatMap((component) => {
      const maximum = threshold(context, rule.id, "maxHooks", 15);
      return component.hooks.length > maximum
        ? [
            finding(
              rule,
              context,
              component.fileId,
              1,
              "Component uses too many hooks",
              `${component.name} uses ${component.hooks.length} distinct hooks.`,
              "Many hooks often indicate mixed responsibilities.",
              "Extract cohesive behavior into custom hooks or child components.",
              [evidence("hooks", component.hooks.length), evidence("threshold", maximum)],
            ),
          ]
        : [];
    }),
  ),
  createRule(
    "anonymous-default-export",
    "Anonymous default export",
    "components",
    Severity.Warning,
    (context, rule) =>
      context.model.exports.flatMap((entry) =>
        entry.isDefault && entry.isAnonymous
          ? [
              finding(
                rule,
                context,
                entry.fileId,
                entry.line,
                "Anonymous default export",
                "A default export has no stable symbol name.",
                "Named exports improve stack traces, DevTools labels, and searchability.",
                "Export a named function or component.",
                [],
              ),
            ]
          : [],
      ),
  ),
  createRule("god-module", "God module", "architecture", Severity.Warning, (context, rule) =>
    context.model.modules.flatMap((module) => {
      const node = context.graph.nodes.find((candidate) => candidate.id === module.id);
      const fanOut = context.graph.edges.filter((edge) => edge.source === module.id).length;
      const fanIn = context.graph.edges.filter((edge) => edge.target === module.id).length;
      const score =
        module.imports.length + module.exports.length + module.lineCount / 25 + fanIn + fanOut;
      const maximum = threshold(context, rule.id, "maxScore", 50);
      return score > maximum
        ? [
            finding(
              rule,
              context,
              module.fileId,
              1,
              "Module has excessive responsibilities",
              `${node?.path ?? module.path} has combined complexity score ${score}.`,
              "Highly connected large modules become change bottlenecks.",
              "Split the module by responsibility and reduce its public surface.",
              [evidence("combinedScore", score), evidence("threshold", maximum)],
            ),
          ]
        : [];
    }),
  ),
  createRule("orphan-module", "Orphan module", "architecture", Severity.Warning, (context, rule) =>
    context.graph.orphans.flatMap((id) => {
      const node = context.graph.nodes.find((candidate) => candidate.id === id);
      return node?.type === "module" && !isToolingConfigFile(node.path)
        ? [
            finding(
              rule,
              context,
              fileIdFromNode(node),
              1,
              "Orphan module",
              `${node.path} has no incoming or outgoing dependencies.`,
              "Isolated modules may be dead code or misplaced implementation.",
              "Delete the module or integrate it into the relevant feature.",
              [],
            ),
          ]
        : [];
    }),
  ),
  createRule("high-fan-out", "High fan-out", "architecture", Severity.Warning, (context, rule) =>
    fanRule(
      context,
      rule,
      "source",
      20,
      "outgoing dependencies",
      "Reduce dependencies or split responsibilities.",
    ),
  ),
  createRule("high-fan-in", "High fan-in", "architecture", Severity.Warning, (context, rule) =>
    fanRule(
      context,
      rule,
      "target",
      30,
      "incoming dependencies",
      "Extract a stable interface or split responsibility.",
    ),
  ),
  createRule(
    "deeply-nested-routes",
    "Deeply nested routes",
    "routes",
    Severity.Warning,
    (context, rule) =>
      context.model.routes.flatMap((route) => {
        const depth = route.path.split("/").filter(Boolean).length;
        const maximum = threshold(context, rule.id, "maxDepth", 8);
        return depth > maximum
          ? [
              finding(
                rule,
                context,
                route.fileId,
                route.line,
                "Route nesting is too deep",
                `${route.path} has ${depth} route levels.`,
                "Deep route hierarchies increase navigation and ownership complexity.",
                "Simplify route structure or introduce clearer route boundaries.",
                [evidence("routeDepth", depth), evidence("threshold", maximum)],
              ),
            ]
          : [];
      }),
  ),
  createRule(
    "oversized-module",
    "Oversized module",
    "complexity",
    Severity.Warning,
    (context, rule) =>
      moduleThresholdRule(
        context,
        rule,
        "maxLines",
        500,
        "lineCount",
        "Module exceeds recommended size",
        "Split the module by responsibility.",
      ),
  ),
  createRule(
    "heavy-import-hub",
    "Heavy import hub",
    "performance",
    Severity.Warning,
    (context, rule) =>
      moduleThresholdRule(
        context,
        rule,
        "maxImports",
        50,
        "imports",
        "Module imports too many dependencies",
        "Extract focused collaborators or reduce dependency breadth.",
      ),
  ),
  createRule(
    "excessive-export-count",
    "Excessive export count",
    "complexity",
    Severity.Warning,
    (context, rule) =>
      moduleThresholdRule(
        context,
        rule,
        "maxExports",
        40,
        "exports",
        "Module exports too many symbols",
        "Split public APIs into focused modules.",
      ),
  ),
  createRule(
    "long-relative-import",
    "Long relative import",
    "imports",
    Severity.Warning,
    (context, rule) =>
      context.model.imports.flatMap((entry) => {
        const traversals = entry.source.split("../").length - 1;
        const maximum = threshold(context, rule.id, "maxParentTraversals", 4);
        return traversals > maximum
          ? [
              finding(
                rule,
                context,
                entry.fileId,
                entry.line,
                "Relative import traverses too far",
                `${entry.source} traverses ${traversals} parent directories.`,
                "Long relative paths are brittle during refactoring.",
                "Use a stable alias or move shared code closer to its consumer.",
                [evidence("parentTraversals", traversals), evidence("threshold", maximum)],
              ),
            ]
          : [];
      }),
  ),
  createRule(
    "excessive-file-count",
    "Excessive file count",
    "architecture",
    Severity.Warning,
    (context, rule) => excessiveFolderFiles(context, rule),
  ),
];

function createRule(
  id: string,
  name: string,
  category: Rule["category"],
  severity: Severity,
  detect: (context: RuleContext, rule: Rule) => readonly Finding[],
): Rule {
  const rule: Rule = {
    category,
    defaultSeverity: severity,
    description: `Detects ${name.toLowerCase()}.`,
    execute: async (context) => detect(context, rule),
    id,
    name,
    supports: () => true,
    tags: [category],
    version: "1.0.0",
  };
  return rule;
}

function finding(
  rule: Rule,
  context: RuleContext,
  fileId: string | undefined,
  line: number,
  title: string,
  description: string,
  rationale: string,
  recommendation: string,
  evidenceItems: readonly FindingEvidence[],
): Finding {
  const file =
    context.project.files.find((candidate) => candidate.id === fileId)?.relativePath ??
    context.project.root;
  return {
    category: rule.category,
    description,
    evidence: evidenceItems,
    id: createHash("sha256").update(`${rule.id}:${file}:${line}:${description}`).digest("hex"),
    location: { column: 1, file, line },
    metadata: {},
    rationale,
    recommendation,
    ruleId: rule.id,
    severity: rule.defaultSeverity,
    title,
  };
}

function evidence(metric: string, value: FindingEvidence["value"]): FindingEvidence {
  return { metric, value };
}
function threshold(context: RuleContext, id: string, name: string, fallback: number): number {
  const setting = context.configuration.rules[id];
  return typeof setting === "object" && typeof setting?.[name] === "number"
    ? setting[name]
    : fallback;
}
function fanRule(
  context: RuleContext,
  rule: Rule,
  direction: "source" | "target",
  fallback: number,
  label: string,
  recommendation: string,
): readonly Finding[] {
  const maximum = threshold(context, rule.id, "maxDependencies", fallback);
  return context.graph.nodes.flatMap((node) => {
    const count = context.graph.edges.filter((edge) => edge[direction] === node.id).length;
    return node.type === "module" && count > maximum
      ? [
          finding(
            rule,
            context,
            fileIdFromNode(node),
            1,
            `Module has high fan-${direction === "source" ? "out" : "in"}`,
            `${node.path} has ${count} ${label}.`,
            "High coupling makes changes harder to isolate.",
            recommendation,
            [evidence("dependencies", count), evidence("threshold", maximum)],
          ),
        ]
      : [];
  });
}
function fileIdFromNode(node: {
  readonly metadata: Readonly<Record<string, unknown>>;
}): string | undefined {
  const fileId = node.metadata.fileId;
  return typeof fileId === "string" ? fileId : undefined;
}

function isFrameworkManagedExport(context: RuleContext, fileId: string): boolean {
  if (context.project.framework !== FrameworkType.Next) return false;
  const path = context.project.files.find((file) => file.id === fileId)?.relativePath;
  return path !== undefined && isNextConventionFile(path);
}

function isNextConventionFile(path: string): boolean {
  return /(?:^|\/)app(?:\/.*)?\/(?:default|error|forbidden|global-error|icon|layout|loading|manifest|not-found|opengraph-image|page|robots|route|sitemap|template|twitter-image|unauthorized)\.[^.]+$/u.test(
    path,
  );
}

function isToolingConfigFile(path: string): boolean {
  const filename = posix.basename(path);
  return /^(?:postcss|tailwind|next|vite|webpack|eslint|prettier|babel|jest|vitest|tsup|playwright|cypress|stylelint|commitlint|lint-staged|release|turbo)\.config(?:\.[^.]+)?$/u.test(
    filename,
  );
}

function moduleThresholdRule(
  context: RuleContext,
  rule: Rule,
  setting: string,
  fallback: number,
  metric: "lineCount" | "imports" | "exports",
  title: string,
  recommendation: string,
): readonly Finding[] {
  const maximum = threshold(context, rule.id, setting, fallback);
  return context.model.modules.flatMap((module) => {
    const value = metric === "lineCount" ? module.lineCount : module[metric].length;
    return value > maximum
      ? [
          finding(
            rule,
            context,
            module.fileId,
            1,
            title,
            `${module.path} has ${value} ${metric === "lineCount" ? "logical lines" : metric}.`,
            "Large modules have broader maintenance surface.",
            recommendation,
            [evidence(metric, value), evidence("threshold", maximum)],
          ),
        ]
      : [];
  });
}
function excessiveFolderFiles(context: RuleContext, rule: Rule): readonly Finding[] {
  const maximum = threshold(context, rule.id, "maxFiles", 100);
  const counts = new Map<string, number>();
  for (const file of context.project.files) {
    const folder = posix.dirname(file.relativePath);
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  return [...counts].flatMap(([folder, count]) =>
    count > maximum
      ? [
          finding(
            rule,
            context,
            undefined,
            1,
            "Folder contains too many files",
            `${folder} contains ${count} files.`,
            "Large folders obscure feature ownership.",
            "Split the folder into cohesive feature areas.",
            [evidence("files", count), evidence("threshold", maximum)],
          ),
        ]
      : [],
  );
}
