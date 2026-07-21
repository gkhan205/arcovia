import { describe, expect, it } from "vitest";

import { resolvePolicyConfiguration } from "../src/config/index.js";
import {
  FrameworkType,
  PackageManager,
  type Project,
  type ProjectModel,
  Severity,
  WorkspaceType,
} from "../src/domain/index.js";
import { PolicyEngine } from "../src/policies/index.js";

const project: Project = {
  files: [
    {
      absolutePath: "/workspace/src/components/Button.tsx",
      extension: ".tsx",
      id: "button",
      isIgnored: false,
      isSkipped: false,
      isStory: false,
      isTest: false,
      lastModified: 0,
      path: "src/components/Button.tsx",
      relativePath: "src/components/Button.tsx",
      size: 1,
    },
    {
      absolutePath: "/workspace/src/server/db.ts",
      extension: ".ts",
      id: "db",
      isIgnored: false,
      isSkipped: false,
      isStory: false,
      isTest: false,
      lastModified: 0,
      path: "src/server/db.ts",
      relativePath: "src/server/db.ts",
      size: 1,
    },
    {
      absolutePath: "/workspace/src/shared/api.ts",
      extension: ".ts",
      id: "api",
      isIgnored: false,
      isSkipped: false,
      isStory: false,
      isTest: false,
      lastModified: 0,
      path: "src/shared/api.ts",
      relativePath: "src/shared/api.ts",
      size: 1,
    },
  ],
  framework: FrameworkType.React,
  id: "fixture",
  metadata: {
    directories: 1,
    hiddenFiles: 0,
    ignoredFiles: 0,
    scanDuration: 0,
    skippedFiles: 0,
    sourceFiles: 3,
    totalFiles: 3,
    workspacePackages: 1,
  },
  name: "fixture",
  packageManager: PackageManager.Pnpm,
  root: "/workspace",
  workspace: WorkspaceType.SinglePackage,
};

function model(importSource = "../server/db"): ProjectModel {
  return {
    components: [],
    contexts: [],
    exports: [],
    hooks: [],
    parseErrors: [],
    routes: [],
    symbols: [],
    imports: [
      {
        fileId: "button",
        isDynamic: false,
        isTypeOnly: false,
        line: 8,
        source: importSource,
        specifiers: ["db"],
        type: "relative",
      },
    ],
    modules: [
      {
        dependencies: [],
        exports: [],
        fileId: "button",
        functionCount: 1,
        id: "button",
        imports: [importSource],
        lineCount: 20,
        path: "src/components/Button.tsx",
      },
      {
        dependencies: [],
        exports: [],
        fileId: "db",
        functionCount: 1,
        id: "db",
        imports: [],
        lineCount: 20,
        path: "src/server/db.ts",
      },
      {
        dependencies: [],
        exports: [],
        fileId: "api",
        functionCount: 1,
        id: "api",
        imports: [],
        lineCount: 20,
        path: "src/shared/api.ts",
      },
    ],
  };
}

describe("architecture policies", () => {
  it("uses no policy preset when no project configuration exists", () => {
    const configuration = resolvePolicyConfiguration(undefined);
    expect(configuration.policies).toEqual([]);
    expect(configuration).toMatchObject({
      presets: [],
      source: "none",
    });
  });

  it("lets a project policy replace a preset policy", () => {
    const configuration = resolvePolicyConfiguration({
      extends: ["arcovia:recommended"],
      policies: [
        {
          id: "no-server-imports",
          description: "Custom boundary",
          from: ["src/components/**"],
          disallow: ["src/backend/**"],
          severity: "warning",
        },
      ],
    });
    expect(configuration.policies).toEqual([
      expect.objectContaining({
        id: "no-server-imports",
        origin: "project",
        severity: Severity.Warning,
      }),
    ]);
    expect(configuration).toMatchObject({
      presets: ["arcovia:recommended"],
      source: "project",
    });
  });

  it("lets a project disable an inherited policy by ID", () => {
    const configuration = resolvePolicyConfiguration({
      extends: ["arcovia:recommended"],
      policies: [{ id: "no-server-imports", enabled: false }],
    });
    expect(configuration.policies).toEqual([]);
  });

  it("reports resolved local imports as one actionable finding per violating import", () => {
    const configuration = resolvePolicyConfiguration({
      policies: [
        {
          id: "no-server-imports",
          description: "No server imports",
          from: ["src/components/**"],
          disallow: ["src/server/**"],
          severity: "error",
        },
      ],
    });
    const result = new PolicyEngine().evaluate({ configuration, model: model(), project });

    expect(result.evaluations).toEqual([
      expect.objectContaining({
        id: "no-server-imports",
        status: "failed",
        violationCount: 1,
        files: ["src/components/Button.tsx"],
      }),
    ]);
    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: "architecture-policy",
        severity: Severity.Error,
        location: { file: "src/components/Button.tsx", line: 8, column: 1 },
        metadata: expect.objectContaining({
          policyId: "no-server-imports",
          targetPath: "src/server/db.ts",
        }),
      }),
    ]);
  });

  it("enforces allowlists and ignores external imports", () => {
    const configuration = resolvePolicyConfiguration({
      policies: [
        {
          id: "shared-only",
          description: "Shared only",
          from: ["src/components/**"],
          allow: ["src/shared/**"],
          severity: "warning",
        },
      ],
    });
    expect(
      new PolicyEngine().evaluate({ configuration, model: model("../shared/api"), project })
        .evaluations[0]?.status,
    ).toBe("passed");
    expect(
      new PolicyEngine().evaluate({ configuration, model: model("react"), project }).findings,
    ).toEqual([]);
  });

  it("rejects ambiguous policy modes", () => {
    expect(() =>
      resolvePolicyConfiguration({
        policies: [
          {
            id: "ambiguous",
            description: "Invalid",
            from: ["src/**"],
            allow: ["src/shared/**"],
            disallow: ["src/server/**"],
            severity: "error",
          },
        ],
      }),
    ).toThrow("cannot define both allow and disallow");
  });
});
