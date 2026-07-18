/** A single column in a plain-text CLI table. */
export interface TableColumn {
  readonly heading: string;
  readonly key: string;
}

/** A row of values displayed by a plain-text CLI table. */
export type TableRow = Readonly<Record<string, string>>;

/** Formats small deterministic result tables for terminal output. */
export function formatTable(columns: readonly TableColumn[], rows: readonly TableRow[]): string {
  const widths = columns.map((column) =>
    Math.max(column.heading.length, ...rows.map((row) => row[column.key]?.length ?? 0)),
  );
  const divider = widths.map((width) => "-".repeat(width)).join("-+-");
  const heading = formatRow(
    columns.map((column) => column.heading),
    widths,
  );
  const body = rows.map((row) =>
    formatRow(
      columns.map((column) => row[column.key] ?? ""),
      widths,
    ),
  );

  return [heading, divider, ...body].join("\n");
}

function formatRow(values: readonly string[], widths: readonly number[]): string {
  return values.map((value, index) => value.padEnd(widths[index] ?? 0)).join(" | ");
}
