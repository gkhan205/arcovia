---
title: Commands
description: CLI commands and common analysis options.
---

## Analyze a project

```bash
arcovia analyze .
```

`analyse` is available as a British-English alias.

## Analyze another directory

```bash
arcovia analyze ../my-next-app
```

## Control generated artifacts

```bash
# Choose where reports are written
arcovia analyze . --output ./reports

# Generate only the HTML report
arcovia analyze . --html

# Generate only the JSON analysis artifact
arcovia analyze . --json

# Generate the HTML report and open it
arcovia analyze . --open
```

## Check your environment

```bash
arcovia doctor
```

Use `doctor` when Arcovia cannot find a supported project or you want to validate the local CLI setup.

## Use custom policy rules

Arcovia `v0.2.0` automatically reads `.arcovia.json` from the analyzed project root.

```bash
arcovia analyze .
```

Use this file to define custom architecture boundaries, extend `arcovia:recommended`, or tune policy scoring. See [custom policy rules](../custom-policy-rules/) for the supported schema.

## Benchmark context

```bash
# Use Arcovia's built-in quality-band baseline
arcovia analyze . --benchmark

# Supply a versioned benchmark profile
arcovia analyze . --benchmark ./arcovia-benchmark.json
```

Benchmark data gives context for a score; it does not change the underlying static-analysis findings.
