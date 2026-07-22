# Changelog

All notable changes to Arcovia are documented in this file.

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
