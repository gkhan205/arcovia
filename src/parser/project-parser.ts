import { createHash } from "node:crypto";
import { resolve } from "node:path";
import * as ts from "typescript";

import {
  type Component,
  type Context,
  type Symbol as DomainSymbol,
  type ExportStatement,
  FrameworkType,
  type Hook,
  type ImportStatement,
  type Module,
  type ParseError,
  type ProjectFile,
  type ProjectModel,
  type Route,
} from "../domain/index.js";

import type { ParserInput } from "./parser-input.js";

/** Builds a semantic project model from source files without executing user code. */
export class ProjectParser {
  /** Parses all eligible files with exactly one TypeScript Program. */
  public parse(input: ParserInput): ProjectModel {
    const files = input.project.files.filter((file) => isParsableFile(file));
    const fileByAbsolutePath = new Map(files.map((file) => [resolve(file.absolutePath), file]));
    const program = ts.createProgram({
      options: this.loadCompilerOptions(input.project.root),
      rootNames: files.map((file) => file.absolutePath),
    });
    const model = createEmptyModel();

    for (const sourceFile of program.getSourceFiles()) {
      const projectFile = fileByAbsolutePath.get(resolve(sourceFile.fileName));
      if (projectFile === undefined) {
        continue;
      }

      const fileModel = this.parseSourceFile(sourceFile, projectFile, input.project.framework);
      appendFileModel(model, fileModel);
      model.parseErrors.push(...collectParseErrors(program, sourceFile, projectFile.id));
    }

    return freezeModel(model);
  }

  private loadCompilerOptions(projectRoot: string): ts.CompilerOptions {
    const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, "tsconfig.json");
    if (configPath === undefined) {
      return defaultCompilerOptions();
    }

    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error !== undefined || !isObject(config.config)) {
      return defaultCompilerOptions();
    }

    return {
      ...defaultCompilerOptions(),
      ...ts.convertCompilerOptionsFromJson(config.config.compilerOptions, projectRoot).options,
    };
  }

  private parseSourceFile(
    sourceFile: ts.SourceFile,
    projectFile: ProjectFile,
    framework: FrameworkType,
  ): MutableFileModel {
    const model = createEmptyFileModel(projectFile.id);
    const exportNames = collectExports(sourceFile, projectFile.id, model.exports);
    const isNextRouteHandlerModule =
      framework === FrameworkType.Next && isNextRouteHandlerFile(projectFile);

    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) {
        model.imports.push(createImportStatement(node, sourceFile, projectFile.id));
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const dynamicImport = createDynamicImportStatement(node, sourceFile, projectFile.id);
        if (dynamicImport !== undefined) {
          model.imports.push(dynamicImport);
        }
      } else if (ts.isFunctionDeclaration(node)) {
        collectFunctionSymbol(node, sourceFile, projectFile.id, model.symbols);
        const component = isNextRouteHandlerModule
          ? undefined
          : createFunctionComponent(node, sourceFile, projectFile.id, exportNames);
        if (component !== undefined) model.components.push(component);
      } else if (ts.isClassDeclaration(node)) {
        collectClassSymbol(node, sourceFile, projectFile.id, model.symbols);
        const component = isNextRouteHandlerModule
          ? undefined
          : createClassComponent(node, sourceFile, projectFile.id, exportNames);
        if (component !== undefined) model.components.push(component);
      } else if (ts.isVariableDeclaration(node)) {
        collectVariableSymbol(node, sourceFile, projectFile.id, model.symbols);
        const component = isNextRouteHandlerModule
          ? undefined
          : createVariableComponent(node, sourceFile, projectFile.id, exportNames);
        if (component !== undefined) model.components.push(component);
      } else if (ts.isInterfaceDeclaration(node)) {
        model.symbols.push(
          createSymbol(node.name.text, "interface", node, sourceFile, projectFile.id),
        );
      } else if (ts.isEnumDeclaration(node)) {
        model.symbols.push(createSymbol(node.name.text, "enum", node, sourceFile, projectFile.id));
      } else if (ts.isTypeAliasDeclaration(node)) {
        model.symbols.push(createSymbol(node.name.text, "type", node, sourceFile, projectFile.id));
      } else if (ts.isCallExpression(node)) {
        const expressionName = getExpressionName(node.expression);
        if (expressionName?.startsWith("use")) {
          model.hooks.push(createHook(node, expressionName, sourceFile, projectFile.id));
        }
        if (expressionName === "createContext" || expressionName === "useContext") {
          model.contexts.push(createContext(node, expressionName, sourceFile, projectFile.id));
        }
      } else if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const route = createReactRouterRoute(node, sourceFile, projectFile.id);
        if (route !== undefined) model.routes.push(route);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    model.routes.push(...createFileRoutes(projectFile, framework));
    model.module = createModule(
      projectFile,
      sourceFile,
      model.imports,
      model.exports,
      model.symbols,
    );
    return model;
  }
}

interface MutableProjectModel {
  components: Component[];
  contexts: Context[];
  exports: ExportStatement[];
  hooks: Hook[];
  imports: ImportStatement[];
  modules: Module[];
  parseErrors: ParseError[];
  routes: Route[];
  symbols: DomainSymbol[];
}

interface MutableFileModel {
  components: Component[];
  contexts: Context[];
  exports: ExportStatement[];
  hooks: Hook[];
  imports: ImportStatement[];
  module?: Module;
  routes: Route[];
  symbols: DomainSymbol[];
}

function appendFileModel(model: MutableProjectModel, fileModel: MutableFileModel): void {
  model.components.push(...fileModel.components);
  model.contexts.push(...fileModel.contexts);
  model.exports.push(...fileModel.exports);
  model.hooks.push(...fileModel.hooks);
  model.imports.push(...fileModel.imports);
  if (fileModel.module !== undefined) model.modules.push(fileModel.module);
  model.routes.push(...fileModel.routes);
  model.symbols.push(...fileModel.symbols);
}

function collectExports(
  sourceFile: ts.SourceFile,
  fileId: string,
  exports: ExportStatement[],
): ReadonlySet<string> {
  for (const statement of sourceFile.statements) {
    const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
    const isExported =
      hasModifier(statement, ts.SyntaxKind.ExportKeyword) || ts.isExportDeclaration(statement);
    if (!isExported) continue;

    if (ts.isExportDeclaration(statement)) {
      const source = statement.moduleSpecifier?.getText(sourceFile).slice(1, -1);
      if (statement.exportClause === undefined) {
        exports.push(
          createExportStatement("*", false, false, statement, sourceFile, fileId, source),
        );
      } else if (ts.isNamespaceExport(statement.exportClause)) {
        exports.push(
          createExportStatement(
            `* as ${statement.exportClause.name.text}`,
            false,
            false,
            statement,
            sourceFile,
            fileId,
            source,
          ),
        );
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          exports.push(
            createExportStatement(
              element.name.text,
              false,
              false,
              element,
              sourceFile,
              fileId,
              source,
            ),
          );
        }
      }
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      exports.push(
        createExportStatement(
          "default",
          true,
          false,
          statement,
          sourceFile,
          fileId,
          undefined,
          ts.isArrowFunction(statement.expression) || ts.isFunctionExpression(statement.expression),
        ),
      );
      continue;
    }

    for (const name of getStatementNames(statement)) {
      exports.push(createExportStatement(name, isDefault, false, statement, sourceFile, fileId));
    }
  }

  return new Set(exports.map((entry) => entry.name));
}

function createImportStatement(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  fileId: string,
): ImportStatement {
  const source = ts.isStringLiteral(node.moduleSpecifier)
    ? node.moduleSpecifier.text
    : node.moduleSpecifier.getText(sourceFile);
  return {
    fileId,
    isDynamic: false,
    isTypeOnly: node.importClause?.isTypeOnly ?? false,
    line: lineOf(node, sourceFile),
    source,
    specifiers: getImportSpecifiers(node.importClause),
    type: dependencyType(source),
  };
}

function createDynamicImportStatement(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  fileId: string,
): ImportStatement | undefined {
  const argument = node.arguments[0];
  if (argument === undefined || !ts.isStringLiteral(argument)) return undefined;
  return {
    fileId,
    isDynamic: true,
    isTypeOnly: false,
    line: lineOf(node, sourceFile),
    source: argument.text,
    specifiers: [],
    type: "dynamic",
  };
}

function createFunctionComponent(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  fileId: string,
  exportNames: ReadonlySet<string>,
): Component | undefined {
  const name = node.name?.text;
  if (name === undefined || !isComponentName(name)) return undefined;
  return createComponent(name, "function", node, sourceFile, fileId, exportNames, node.parameters);
}

function createClassComponent(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  fileId: string,
  exportNames: ReadonlySet<string>,
): Component | undefined {
  const name = node.name?.text;
  if (name === undefined || !isComponentName(name)) return undefined;
  return createComponent(name, "class", node, sourceFile, fileId, exportNames, []);
}

function createVariableComponent(
  node: ts.VariableDeclaration,
  sourceFile: ts.SourceFile,
  fileId: string,
  exportNames: ReadonlySet<string>,
): Component | undefined {
  if (
    !ts.isIdentifier(node.name) ||
    !isComponentName(node.name.text) ||
    node.initializer === undefined
  )
    return undefined;
  if (!ts.isArrowFunction(node.initializer) && !isReactComponentWrapper(node.initializer))
    return undefined;
  const parameters = ts.isArrowFunction(node.initializer) ? node.initializer.parameters : [];
  return createComponent(
    node.name.text,
    "arrow",
    node,
    sourceFile,
    fileId,
    exportNames,
    parameters,
  );
}

function createComponent(
  name: string,
  type: Component["type"],
  node: ts.Node,
  sourceFile: ts.SourceFile,
  fileId: string,
  exportNames: ReadonlySet<string>,
  parameters: readonly ts.ParameterDeclaration[],
): Component {
  return {
    exports: exportNames.has(name) ? [name] : [],
    fileId,
    hooks: collectNestedHookNames(node),
    id: createId(`${fileId}:component:${name}:${node.pos}`),
    jsxDepth: calculateJsxDepth(node),
    lineCount: countLogicalLines(node.getText(sourceFile)),
    name,
    props: parameters.map((parameter) => parameter.name.getText(sourceFile)),
    type,
  };
}

function createHook(
  node: ts.CallExpression,
  name: string,
  sourceFile: ts.SourceFile,
  fileId: string,
): Hook {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    arguments: node.arguments.map((argument) => argument.getText(sourceFile)),
    column: position.character + 1,
    fileId,
    id: createId(`${fileId}:hook:${name}:${node.pos}`),
    line: position.line + 1,
    name,
  };
}

function createContext(
  node: ts.CallExpression,
  name: string,
  sourceFile: ts.SourceFile,
  fileId: string,
): Context {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    column: position.character + 1,
    fileId,
    id: createId(`${fileId}:context:${name}:${node.pos}`),
    kind: name === "createContext" ? "create" : "use",
    line: position.line + 1,
    name,
  };
}

function createReactRouterRoute(
  node: ts.JsxSelfClosingElement | ts.JsxOpeningElement,
  sourceFile: ts.SourceFile,
  fileId: string,
): Route | undefined {
  if (node.tagName.getText(sourceFile) !== "Route") return undefined;
  const pathAttribute = node.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) &&
      ts.isIdentifier(attribute.name) &&
      attribute.name.text === "path",
  );
  const initializer = pathAttribute?.initializer;
  if (initializer === undefined || !ts.isStringLiteral(initializer)) return undefined;
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    column: position.character + 1,
    fileId,
    id: createId(`${fileId}:route:${initializer.text}:${node.pos}`),
    kind: "react-router",
    line: position.line + 1,
    path: initializer.text,
  };
}

function createFileRoutes(file: ProjectFile, framework: FrameworkType): readonly Route[] {
  const path = file.relativePath.replace(/\.[^.]+$/u, "");
  const appRoute = path.match(/(?:^|\/)app(?:\/(.*))?\/(?:page|route)$/u);
  if (framework === FrameworkType.Next && appRoute !== null) {
    return [createFileRoute(file, `/${appRoute[1] ?? ""}`, "next-app")];
  }
  const pagesRoute = path.match(/(?:^|\/)pages\/(.*)$/u);
  if (framework === FrameworkType.Next && pagesRoute !== null) {
    const routePath = `/${pagesRoute[1] ?? ""}`.replace(/\/index$/u, "/");
    return [createFileRoute(file, routePath, "next-pages")];
  }
  return [];
}

function isNextRouteHandlerFile(file: ProjectFile): boolean {
  return /(?:^|\/)app(?:\/.*)?\/route\.[^.]+$/u.test(file.relativePath);
}

function createFileRoute(file: ProjectFile, path: string, kind: Route["kind"]): Route {
  return {
    column: 1,
    fileId: file.id,
    id: createId(`${file.id}:route:${path}`),
    kind,
    line: 1,
    path,
  };
}

function createModule(
  file: ProjectFile,
  sourceFile: ts.SourceFile,
  imports: readonly ImportStatement[],
  exports: readonly ExportStatement[],
  symbols: readonly DomainSymbol[],
): Module {
  return {
    dependencies: imports.map((entry) => entry.source),
    exports: exports.map((entry) => entry.name),
    fileId: file.id,
    functionCount: symbols.filter((symbol) => symbol.type === "function").length,
    id: createId(`${file.id}:module`),
    imports: imports.map((entry) => entry.source),
    lineCount: sourceFile.getLineAndCharacterOfPosition(sourceFile.end).line + 1,
    path: file.relativePath,
  };
}

function createExportStatement(
  name: string,
  isDefault: boolean,
  isTypeOnly: boolean,
  node: ts.Node,
  sourceFile: ts.SourceFile,
  fileId: string,
  source?: string,
  isAnonymous = false,
): ExportStatement {
  return {
    fileId,
    isAnonymous,
    isDefault,
    isTypeOnly,
    line: lineOf(node, sourceFile),
    name,
    ...(source === undefined ? {} : { source }),
  };
}

function collectFunctionSymbol(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  fileId: string,
  symbols: DomainSymbol[],
): void {
  if (node.name !== undefined)
    symbols.push(createSymbol(node.name.text, "function", node, sourceFile, fileId));
}

function collectClassSymbol(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  fileId: string,
  symbols: DomainSymbol[],
): void {
  if (node.name !== undefined)
    symbols.push(createSymbol(node.name.text, "class", node, sourceFile, fileId));
}

function collectVariableSymbol(
  node: ts.VariableDeclaration,
  sourceFile: ts.SourceFile,
  fileId: string,
  symbols: DomainSymbol[],
): void {
  if (ts.isIdentifier(node.name))
    symbols.push(createSymbol(node.name.text, "variable", node, sourceFile, fileId));
}

function createSymbol(
  name: string,
  type: DomainSymbol["type"],
  node: ts.Node,
  sourceFile: ts.SourceFile,
  fileId: string,
): DomainSymbol {
  return {
    fileId,
    id: createId(`${fileId}:symbol:${type}:${name}:${node.pos}`),
    line: lineOf(node, sourceFile),
    name,
    type,
  };
}

function collectParseErrors(
  program: ts.Program,
  sourceFile: ts.SourceFile,
  fileId: string,
): readonly ParseError[] {
  return program.getSyntacticDiagnostics(sourceFile).map((diagnostic) => {
    const position = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    return {
      column: position.character + 1,
      fileId,
      line: position.line + 1,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
      severity: "error",
    };
  });
}

function createEmptyModel(): MutableProjectModel {
  return {
    components: [],
    contexts: [],
    exports: [],
    hooks: [],
    imports: [],
    modules: [],
    parseErrors: [],
    routes: [],
    symbols: [],
  };
}

function createEmptyFileModel(_fileId: string): MutableFileModel {
  return {
    components: [],
    contexts: [],
    exports: [],
    hooks: [],
    imports: [],
    routes: [],
    symbols: [],
  };
}

function freezeModel(model: MutableProjectModel): ProjectModel {
  return {
    components: sortById(model.components),
    contexts: sortById(model.contexts),
    exports: sortByFileAndLine(model.exports),
    hooks: sortById(model.hooks),
    imports: sortByFileAndLine(model.imports),
    modules: sortById(model.modules),
    parseErrors: sortByFileAndLine(model.parseErrors),
    routes: sortById(model.routes),
    symbols: sortById(model.symbols),
  };
}

function defaultCompilerOptions(): ts.CompilerOptions {
  return {
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
  };
}

function dependencyType(source: string): ImportStatement["type"] {
  return source.startsWith(".") ? "relative" : "package";
}

function getImportSpecifiers(clause: ts.ImportClause | undefined): readonly string[] {
  if (clause === undefined) return [];
  const names = clause.name === undefined ? [] : [clause.name.text];
  if (clause.namedBindings === undefined) return names;
  if (ts.isNamespaceImport(clause.namedBindings))
    return [...names, `* as ${clause.namedBindings.name.text}`];
  return [...names, ...clause.namedBindings.elements.map((element) => element.name.text)];
}

function getStatementNames(statement: ts.Statement): readonly string[] {
  if (
    (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
    statement.name !== undefined
  )
    return [statement.name.text];
  if (ts.isVariableStatement(statement))
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
  return [];
}

function getExpressionName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false)
  );
}

function isComponentName(name: string): boolean {
  return /^[A-Z]/u.test(name);
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isParsableFile(file: ProjectFile): boolean {
  return (
    !file.isIgnored && !file.isSkipped && !/\.(generated|gen)\.[^.]+$/u.test(file.relativePath)
  );
}

function isReactComponentWrapper(initializer: ts.Expression): boolean {
  return (
    ts.isCallExpression(initializer) &&
    ["memo", "forwardRef", "lazy"].includes(getExpressionName(initializer.expression) ?? "")
  );
}

function lineOf(node: ts.Node, sourceFile: ts.SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function collectNestedHookNames(node: ts.Node): readonly string[] {
  const names = new Set<string>();
  const visit = (child: ts.Node): void => {
    if (ts.isCallExpression(child)) {
      const name = getExpressionName(child.expression);
      if (name?.startsWith("use")) names.add(name);
    }
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return [...names].sort();
}

function calculateJsxDepth(node: ts.Node): number {
  let maximum = 0;
  const visit = (child: ts.Node, depth: number): void => {
    const nextDepth =
      ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)
        ? depth + 1
        : depth;
    maximum = Math.max(maximum, nextDepth);
    ts.forEachChild(child, (nested) => visit(nested, nextDepth));
  };
  visit(node, 0);
  return maximum;
}

function countLogicalLines(source: string): number {
  return source.split(/\r?\n/u).filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed.length > 0 &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("/*") &&
      !trimmed.startsWith("*")
    );
  }).length;
}

function createId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sortByFileAndLine<T extends { readonly fileId: string; readonly line: number }>(
  values: readonly T[],
): readonly T[] {
  return [...values].sort(
    (left, right) => left.fileId.localeCompare(right.fileId) || left.line - right.line,
  );
}

function sortById<T extends { readonly id: string }>(values: readonly T[]): readonly T[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}
