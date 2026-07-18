import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FrameworkType } from "../src/domain/index.js";
import { ProjectParser } from "../src/parser/index.js";
import { ProjectScanner } from "../src/scanner/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function createProject(files: Readonly<Record<string, string>>): Promise<string> {
  const projectPath = await mkdtemp(join(tmpdir(), "arcovia-parser-"));
  temporaryDirectories.push(projectPath);

  for (const [relativePath, content] of Object.entries(files)) {
    const destination = join(projectPath, relativePath);
    await mkdir(join(destination, ".."), { recursive: true });
    await writeFile(destination, content);
  }

  return projectPath;
}

describe("ProjectParser", () => {
  it("extracts imports, exports, components, hooks, contexts, routes, and symbols in one model", async () => {
    const projectPath = await createProject({
      "package.json": '{"name":"react-example","dependencies":{"react":"19.0.0"}}',
      "src/app.tsx": [
        'import type { Props } from "./types";',
        'import React, { createContext, useContext, useState } from "react";',
        'const Deferred = await import("./deferred");',
        "const AppContext = createContext(null);",
        "export const App = () => {",
        "  const [count] = useState(0);",
        '  return <Route path="/home" />;',
        "};",
        "export default function Button({ label }: Props) {",
        "  useContext(AppContext);",
        "  return <button>{label}</button>;",
        "}",
        "export { Deferred };",
      ].join("\n"),
    });
    const project = await new ProjectScanner().scan({ projectPath });

    const model = new ProjectParser().parse({ project });

    expect(model.modules).toHaveLength(1);
    expect(model.imports.map((entry) => entry.source)).toEqual(["./types", "react", "./deferred"]);
    expect(model.imports[0]?.isTypeOnly).toBe(true);
    expect(model.imports[2]?.isDynamic).toBe(true);
    expect(model.exports.map((entry) => entry.name)).toEqual(["App", "Button", "Deferred"]);
    expect(model.components.map((component) => component.name).sort()).toEqual(["App", "Button"]);
    expect(model.components.find((component) => component.name === "App")?.hooks).toEqual([
      "useState",
    ]);
    expect(model.hooks.map((hook) => hook.name).sort()).toEqual(["useContext", "useState"]);
    expect(model.contexts.map((context) => context.kind).sort()).toEqual(["create", "use"]);
    expect(model.routes[0]?.path).toBe("/home");
    expect(model.symbols.map((symbol) => symbol.name)).toContain("App");
  });

  it("discovers Next.js app-router routes", async () => {
    const projectPath = await createProject({
      "app/dashboard/page.tsx": "export default function Dashboard() { return <main />; }",
      "package.json": '{"name":"next-example","dependencies":{"next":"15.0.0"}}',
    });
    const project = await new ProjectScanner().scan({ projectPath });

    const model = new ProjectParser().parse({ project });

    expect(project.framework).toBe(FrameworkType.Next);
    expect(model.routes).toHaveLength(1);
    expect(model.routes[0]?.kind).toBe("next-app");
    expect(model.routes[0]?.path).toBe("/dashboard");
  });

  it("does not classify Next.js route handlers as React components", async () => {
    const projectPath = await createProject({
      "app/api/jobs/route.ts": [
        "export async function GET() { return Response.json({ jobs: [] }); }",
        "export async function POST() { return Response.json({ created: true }); }",
      ].join("\n"),
      "package.json": '{"name":"next-route-handlers","dependencies":{"next":"15.0.0"}}',
    });
    const project = await new ProjectScanner().scan({ projectPath });

    const model = new ProjectParser().parse({ project });

    expect(model.components).toEqual([]);
    expect(model.symbols.map((symbol) => symbol.name).sort()).toEqual(["GET", "POST"]);
  });

  it("keeps imported child components distinct from their parent component", async () => {
    const projectPath = await createProject({
      "package.json": '{"name":"component-imports","dependencies":{"react":"19.0.0"}}',
      "src/modules/landing-new/final-cta/index.tsx":
        "export default function FinalCTA() { return <section />; }",
      "src/modules/landing-new/index.tsx": [
        'import FinalCTA from "./final-cta";',
        "export default function LandingNew() { return <FinalCTA />; }",
      ].join("\n"),
    });
    const project = await new ProjectScanner().scan({ projectPath });

    const model = new ProjectParser().parse({ project });

    expect(model.components.map((component) => component.name).sort()).toEqual([
      "FinalCTA",
      "LandingNew",
    ]);
  });

  it("normalizes root App Router and Pages Router routes", async () => {
    const projectPath = await createProject({
      "app/page.tsx": "export default function Home() { return <main />; }",
      "package.json": '{"name":"next-routes","dependencies":{"next":"15.0.0"}}',
      "pages/index.tsx": "export default function LegacyHome() { return <main />; }",
    });
    const project = await new ProjectScanner().scan({ projectPath });

    const model = new ProjectParser().parse({ project });

    expect(model.routes.map((route) => route.path).sort()).toEqual(["/", "/"]);
  });

  it("records syntax diagnostics and continues parsing other files", async () => {
    const projectPath = await createProject({
      "package.json": '{"name":"broken-example"}',
      "src/broken.ts": "const = ;",
      "src/valid.ts": "export function Valid() { return null; }",
    });
    const project = await new ProjectScanner().scan({ projectPath });

    const model = new ProjectParser().parse({ project });

    expect(model.parseErrors).not.toHaveLength(0);
    expect(model.modules).toHaveLength(2);
    expect(model.components.map((component) => component.name)).toContain("Valid");
  });
});
