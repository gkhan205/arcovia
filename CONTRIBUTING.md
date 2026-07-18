# Contributing to Arcovia

Thanks for helping improve Arcovia. Contributions should make the analysis more accurate, explainable, and useful for teams maintaining React and Next.js applications.

## Before you start

- Search existing issues and pull requests before opening a new one.
- Open an issue first for substantial rules, scoring changes, or report redesigns.
- Keep pull requests focused on one user-visible problem.

## Local setup

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

Run a local analysis with:

```bash
node dist/cli.js analyze ./path-to-project
```

## Contribution expectations

1. Add or update tests for behavior changes.
2. Preserve deterministic output: stable sorting and no machine-specific paths in artifacts.
3. Treat false positives as product bugs. Framework conventions must be considered before adding a finding.
4. Keep scoring explainable. Every score adjustment needs a visible reason in the report.
5. Do not add network-dependent behavior to the default analysis path.
6. Run `pnpm lint`, `pnpm test`, and `pnpm typecheck` before opening a pull request.

## Adding or changing a rule

Rules belong in `src/rules/`. A rule should have:

- a stable rule ID and category;
- clear, actionable recommendation text;
- structured evidence rather than only a prose description;
- tests covering both detection and known framework-safe cases;
- an appropriate scoring impact and cap where repeated findings can be noisy.

## Pull request checklist

- [ ] Scope and motivation are described.
- [ ] Tests cover the change.
- [ ] Existing tests still pass.
- [ ] CLI and HTML output remain understandable.
- [ ] README documentation is updated when users need to change how they use Arcovia.

## Reporting issues

For an analysis-quality issue, include a minimal reproducible project or a sanitized `analysis.json`, the Arcovia version, the command you ran, expected behavior, and actual behavior.
Do not include secrets, API keys, cookies, or proprietary source code.
