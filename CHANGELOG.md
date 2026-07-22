# Changelog

All notable changes to Arcovia are documented in this file.

## v0.2.0

### Added

- Custom policy rules through `.arcovia.json` for project-specific architecture boundaries.
- `arcovia:recommended` policy preset support with project-level overrides and disabled inherited policies.
- Policy findings in the CLI summary, JSON artifact, and HTML report.
- Configurable policy score penalties through `policyScore`.
- Public documentation for custom policy rules, including schema fields, common patterns, presets, and invalid configuration behavior.

### Changed

- Architecture policy guidance now points to the public documentation site instead of internal engineering docs.

## v0.1.3 

### Fixed

- Resolved Windows `npx` HTML report generation by normalizing compiled report-asset paths before
  loading `dist/report/app.css` and `dist/report/app.js`.

## v0.1.2

### Added

- Offline HTML and versioned JSON architecture reports.
- Explainable category scoring, maintenance burden, critical-risk adjustment, and A− grade band.
- Interactive grouped dependency graph, hotspot analysis, Quick Wins, and refactoring roadmap.
- Report history with timeline and links to archived HTML reports.
- Empirical benchmark profiles through `--benchmark <path>` and Arcovia quality bands through
  `--benchmark`.

### Changed

- Default reports are written to `.arcovia-report` and previous reports are archived automatically.
- README is the public product source of truth.
