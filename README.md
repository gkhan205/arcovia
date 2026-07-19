<!-- ![npm](https://img.shields.io/npm/v/arcovia) ![downloads](https://img.shields.io/npm/dm/arcovia) ![license](https://img.shields.io/github/license/gkhan205/arcovia) ![Node](https://img.shields.io/badge/node-22+-green) -->

![arcovia banner](/images/banner.png)

# Arcovia

**Understand, measure, and improve the architecture of React and Next.js applications.**

Arcovia scans a project, builds its dependency model, evaluates deterministic architecture rules, and produces an actionable architecture report. It is designed to answer three practical questions:

1. Is this frontend architecture healthy?
2. Why did it receive this score?
3. What should the team fix first?

Arcovia's findings and scores come entirely from deterministic static analysis.

## Quick start

Run Arcovia from the project you want to inspect:

```bash
npx arcovia analyze .
```

![CLI Output](/images/cli-output.png)

## Why Arcovia?

| Traditional tools | Arcovia |
| --- | --- |
| Lint warnings | Architecture intelligence |
| File-level checks | Whole-project analysis |
| Hard to prioritize | Prioritized hotspots and Quick Wins |
| No architectural score | Explainable architecture score |
| Static diagnostics | Actionable roadmap |

## Supported frameworks

- ✅ React
- ✅ Next.js
- ✅ Vite
- 🧪 Remix (experimental React-compatible analysis)

## Features

- ✅ Architecture Score
- ✅ Dependency Graph
- ✅ Hotspots
- ✅ Quick Wins
- ✅ Architecture Timeline
- ✅ Offline HTML Report
- ✅ JSON Report
- ✅ Deterministic Rules
- ✅ No Cloud Required

## Privacy

Arcovia runs entirely on your machine. No source code leaves your computer, no account is required, and Arcovia does not collect telemetry.

## Reports

Each analysis produces a terminal summary plus portable reports:

- `report.html` — an offline interactive architecture report
- `analysis.json` — a versioned, machine-readable analysis artifact

The HTML report includes:

- Architecture score, letter grade, and visible score calculation
- Evidence-based architecture overview and confirmed strengths
- Filterable findings with locations, evidence, and recommendations
- Grouped dependency graph with user code separated from external packages
- Category health and score contributors
- Hotspots, Quick Wins, and a three-step refactoring roadmap
- Optional peer benchmark context
- Score timeline assembled from previous archived Arcovia reports

Or install it globally:

```bash
npm install -g arcovia
arcovia analyze .
```

By default, Arcovia writes reports to `.arcovia-report` in the analyzed project:

```text
.arcovia-report/
  analysis.json
  report.html
```

Open `report.html` in any browser. It is self-contained: no server, account, or network connection is required.

## Commands

```bash
# Analyze the current project and create HTML + JSON reports
arcovia analyze .

# British-English alias
arcovia analyse .

# Analyze another project
arcovia analyze ../my-next-app

# Choose an output directory
arcovia analyze . --output ./reports

# Generate only selected artifacts
arcovia analyze . --html
arcovia analyze . --json

# Generate the HTML report and open it in your default browser
arcovia analyze . --open

# Check the CLI environment
arcovia doctor
```

## Report history and timeline

Arcovia keeps the latest report at predictable paths and archives the prior version on every new
analysis:

```text
.arcovia-report/
  analysis.json
  report.html
  history/
    analysis-2026-07-18T12-00-00-000Z.json
    report-2026-07-18T12-00-00-000Z.html
```

The next report reads archived analysis artifacts and displays up to eight historical score points in the HTML timeline. Run Arcovia periodically - weekly or in CI to make architectural progress visible over time.

## Scoring

Arcovia does not simply count findings. The final score is designed to reward healthy categories while ensuring real architectural debt stays visible.

```text
100
− category deductions
− maintenance-burden adjustment
− critical-risk adjustment
= final architecture score
```

### Category health

Rule findings affect these weighted categories:

| Category | Weight |
| --- | ---: |
| Architecture | 30% |
| Imports | 15% |
| Components | 15% |
| Complexity | 10% |
| Hooks | 10% |
| Performance | 10% |
| Context | 5% |
| Routes | 5% |

Repeated findings use diminishing penalties and certain hygiene rules have caps, so hundreds of near-identical signals cannot dominate a result.

### Maintenance burden

Large collections of warnings, errors, and informational debt apply a separate capped adjustment. This prevents a project with many actionable findings from appearing flawless while avoiding the opposite failure mode of making it look irredeemable.

### Critical risk

Verified critical findings apply a bounded adjustment of `10 + 8 + 6 + 4` points (maximum 28).
The report shows this separately from category health.

### Grades

| Score | Grade |
| --- | --- |
| 97–100 | A+ |
| 93–96.99 | A |
| 90–92.99 | A− |
| 85–89.99 | B+ |
| 75–84.99 | B |
| 65–74.99 | C+ |
| 55–64.99 | C |
| 40–54.99 | D |
| Below 40 | F |

An estimated recovery shown in a Hotspot, Quick Win, or roadmap item is only the relevant category weighted deduction. It is a planning estimate, not a guarantee of the final score after a refactor.

## Findings Arcovia currently evaluates

Examples include:

- Circular module dependencies
- Orphan modules
- Duplicate imports
- Unused internal exports
- Large components and deeply nested JSX
- God modules
- High fan-in and fan-out modules
- Deep dependency chains

Framework-aware behavior avoids common Next.js false positives, including route handler methods such as `GET` and `POST`, route-page exports, and Next.js metadata exports such as `generateMetadata`, `generateStaticParams`, and `revalidate`.

## Benchmarking

Run the built-in Arcovia quality-band baseline with no file:

```bash
arcovia analyze . --benchmark
```

This gives threshold context, not a claim about peer percentiles. Supply a versioned benchmark profile for real peer context:

```bash
arcovia analyze . --benchmark ./arcovia-benchmark.json
```

Example profile:

```json
{
  "cohort": "Next.js production applications",
  "framework": "next",
  "sampleSize": 40,
  "score": {
    "p25": 55,
    "p50": 70,
    "p75": 85
  },
  "version": "2026.07"
}
```

Arcovia compares the final score with the distribution:

| Score | Report label |
| --- | --- |
| At or above p75 | Top quartile |
| At or above p50 | Above median |
| At or above p25 | Middle half |
| Below p25 | Below median |

The benchmark framework must match the scanned project. If no profile is supplied, or it does not match, the report explicitly says that peer comparison is unavailable rather than inventing a percentage.

## Requirements

- Node.js 22 or newer
- pnpm 10 or newer for repository development

## Open source

Arcovia is available under the [MIT License](LICENSE). Before contributing, read
[CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and
[SECURITY.md](SECURITY.md). General help is covered in [SUPPORT.md](SUPPORT.md), and released
changes are recorded in [CHANGELOG.md](CHANGELOG.md). See [TRADEMARKS.md](TRADEMARKS.md)
for project brand use and logo/icon provenance.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

Run the local compiled CLI with:

```bash
node dist/cli.js analyze .
```

## Repository layout

```text
src/
  cli/          command interface
  core/         pipeline orchestration and report history
  scanner/      file discovery
  parser/       AST parsing
  graph/        dependency relationships
  rules/        deterministic checks
  score/        architecture scoring
  reporters/    terminal, JSON, and offline HTML rendering
```

## Roadmap

- GitHub Action
- VS Code extension
- Report comparison
- Expanded trend analysis
- Team dashboard
- AI Architecture Coach (cloud-based, opt-in)

## Try Arcovia

```bash
npx arcovia analyze .
```

If you find a bug or have an idea, we’d love your feedback through [GitHub Issues](https://github.com/gkhan205/arcovia/issues) and [GitHub Discussions](https://github.com/gkhan205/arcovia/discussions).
