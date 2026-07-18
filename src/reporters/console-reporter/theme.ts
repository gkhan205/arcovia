import picocolors from "picocolors";

import { Severity } from "../../domain/index.js";

export interface ConsoleTheme {
  readonly border: string;
  readonly error: (value: string) => string;
  readonly info: (value: string) => string;
  readonly success: (value: string) => string;
  readonly symbols: {
    readonly failure: string;
    readonly info: string;
    readonly success: string;
    readonly warning: string;
  };
  readonly warning: (value: string) => string;
}

/** Creates the color and glyph policy for one terminal rendering. */
export function createConsoleTheme(colors: boolean, unicode: boolean): ConsoleTheme {
  const palette = picocolors.createColors(colors);
  return {
    border: unicode ? "━" : "-",
    error: palette.red,
    info: palette.blue,
    success: palette.green,
    symbols: unicode
      ? { failure: "✖", info: "●", success: "✓", warning: "⚠" }
      : { failure: "X", info: "*", success: "OK", warning: "!" },
    warning: palette.yellow,
  };
}

/** Styles a visible severity label while retaining an accessible text identifier. */
export function styleSeverity(severity: Severity, label: string, theme: ConsoleTheme): string {
  if (severity === Severity.Critical || severity === Severity.Error) return theme.error(label);
  if (severity === Severity.Warning) return theme.warning(label);
  return theme.info(label);
}
