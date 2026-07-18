# Arcovia

Arcovia is an architecture intelligence CLI for React and Next.js applications.
It performs deterministic static analysis and will produce a canonical
`analysis.json` artifact and HTML report. AI is an optional explanation layer,
not a source of findings.

## Prerequisites

- Node.js 22 or newer
- pnpm 10 or newer

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

Run the current CLI shell with:

```bash
node dist/cli.js --help
```

The analysis command is introduced in the CLI specification. Project setup is
intentionally limited to the shared foundation and tooling.

## Environment

Copy `.env.example` if you need to document local values. Arcovia supports:

- `ARCOVIA_DEBUG=true` to enable debug logging
- `OPENAI_API_KEY` for the future optional AI-review provider

## Repository layout

The single-package MVP preserves the module boundaries needed for a future
workspace split:

```text
src/
  cli/          command interface
  core/         pipeline orchestration
  scanner/      file discovery
  parser/       AST parsing
  graph/        dependency relationships
  rules/        deterministic checks
  score/        architecture scoring
  reporters/    artifact rendering
  providers/    optional external AI providers
```

See [the engineering specifications](docs/README.md) for the full project
architecture and implementation order.
