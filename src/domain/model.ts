import type { Component } from "./component.js";
import type { ExportStatement, ImportStatement } from "./dependency.js";
import type { Module } from "./module.js";

/** A hook declaration discovered in a source file. */
export interface Hook {
  readonly arguments: readonly string[];
  readonly column: number;
  readonly fileId: string;
  readonly id: string;
  readonly line: number;
  readonly name: string;
}

/** A context declaration discovered in a source file. */
export interface Context {
  readonly column: number;
  readonly fileId: string;
  readonly id: string;
  readonly kind: "create" | "use" | "provider" | "consumer";
  readonly line: number;
  readonly name: string;
}

/** A route declaration discovered in a source file. */
export interface Route {
  readonly column: number;
  readonly fileId: string;
  readonly id: string;
  readonly kind: "next-app" | "next-pages" | "react-router";
  readonly line: number;
  readonly path: string;
}

/** A declared source symbol retained for report generation and rule evaluation. */
export interface Symbol {
  readonly fileId: string;
  readonly id: string;
  readonly line: number;
  readonly name: string;
  readonly type: "function" | "variable" | "class" | "interface" | "enum" | "type";
}

/** A recoverable syntax diagnostic encountered while parsing a source file. */
export interface ParseError {
  readonly column: number;
  readonly fileId: string;
  readonly line: number;
  readonly message: string;
  readonly severity: "error" | "warning";
}

/** The framework-independent parsed model of a project. */
export interface ProjectModel {
  readonly components: readonly Component[];
  readonly contexts: readonly Context[];
  readonly exports: readonly ExportStatement[];
  readonly hooks: readonly Hook[];
  readonly imports: readonly ImportStatement[];
  readonly modules: readonly Module[];
  readonly parseErrors: readonly ParseError[];
  readonly routes: readonly Route[];
  readonly symbols: readonly Symbol[];
}
