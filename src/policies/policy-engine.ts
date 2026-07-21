import { createHash } from "node:crypto";

import type {
  Finding,
  ImportStatement,
  PolicyEvaluation,
  Project,
  ProjectModel,
} from "../domain/index.js";
import { resolveLocalModule } from "../graph/module-resolver.js";

import type { ArchitecturePolicy, PolicyConfiguration } from "./policy.js";

/** Evaluates configured module-boundary policies against resolved local imports. */
export class PolicyEngine {
  public evaluate(input: {
    readonly configuration: PolicyConfiguration;
    readonly model: ProjectModel;
    readonly project: Project;
  }): { readonly evaluations: readonly PolicyEvaluation[]; readonly findings: readonly Finding[] } {
    const imports = [
      ...input.model.imports.filter((entry) => !entry.isDynamic),
      ...reExports(input.model),
    ];
    const moduleByFileId = new Map(input.model.modules.map((module) => [module.fileId, module]));
    const files = new Map(input.project.files.map((file) => [file.id, file.relativePath]));
    const findings: Finding[] = [];
    const evaluations = input.configuration.policies.map((policy) => {
      const policyFindings = imports.flatMap((statement) => {
        const source = moduleByFileId.get(statement.fileId);
        if (source === undefined || !matchesAny(source.path, policy.from)) return [];
        const target = resolveLocalModule(statement.source, source.path, input.model.modules);
        if (target === undefined || !isViolation(target.path, policy)) return [];
        const file = files.get(statement.fileId) ?? source.path;
        return [createFinding(policy, file, source.path, target.path, statement)];
      });
      findings.push(...policyFindings);
      const affectedFiles = [
        ...new Set(policyFindings.map((finding) => finding.location.file)),
      ].sort();
      return {
        description: policy.description,
        files: affectedFiles,
        id: policy.id,
        origin: policy.origin,
        severity: policy.severity,
        status: policyFindings.length === 0 ? "passed" : "failed",
        violationCount: policyFindings.length,
      } satisfies PolicyEvaluation;
    });
    return {
      evaluations: Object.freeze(
        evaluations.sort((left, right) => left.id.localeCompare(right.id)),
      ),
      findings: Object.freeze(findings.sort(compareFindings)),
    };
  }
}

function reExports(model: ProjectModel): readonly ImportStatement[] {
  return model.exports.flatMap((entry) =>
    entry.source === undefined
      ? []
      : [
          {
            fileId: entry.fileId,
            isDynamic: false,
            isTypeOnly: entry.isTypeOnly,
            line: entry.line,
            source: entry.source,
            specifiers: [entry.name],
            type: entry.source.startsWith(".") ? "relative" : "package",
          },
        ],
  );
}

function isViolation(target: string, policy: ArchitecturePolicy): boolean {
  return policy.disallow !== undefined
    ? matchesAny(target, policy.disallow)
    : !matchesAny(target, policy.allow ?? []);
}

function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => globPattern(pattern).test(path));
}

function globPattern(pattern: string): RegExp {
  const escaped = pattern
    .replaceAll("\\", "/")
    .replace(/^\.\//u, "")
    .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replaceAll("**", "\u0000")
    .replaceAll("*", "[^/]*")
    .replaceAll("\u0000", ".*");
  return new RegExp(`^${escaped}$`, "u");
}

function createFinding(
  policy: ArchitecturePolicy,
  file: string,
  sourcePath: string,
  targetPath: string,
  statement: ImportStatement,
): Finding {
  const description = `${sourcePath} imports ${targetPath}, which violates policy ${policy.id}.`;
  return {
    category: "architecture",
    description,
    evidence: [
      { metric: "source", value: sourcePath },
      { metric: "target", value: targetPath },
      { metric: "policyMode", value: policy.disallow === undefined ? "allow" : "disallow" },
    ],
    id: createHash("sha256")
      .update(`architecture-policy:${policy.id}:${file}:${statement.line}:${targetPath}`)
      .digest("hex"),
    location: { column: 1, file, line: statement.line },
    metadata: { policyDescription: policy.description, policyId: policy.id, targetPath },
    rationale: policy.description,
    recommendation: policy.recommendation,
    ruleId: "architecture-policy",
    severity: policy.severity,
    title: `Policy violation: ${policy.id}`,
  };
}

function compareFindings(left: Finding, right: Finding): number {
  return (
    left.location.file.localeCompare(right.location.file) ||
    left.location.line - right.location.line ||
    left.id.localeCompare(right.id)
  );
}
