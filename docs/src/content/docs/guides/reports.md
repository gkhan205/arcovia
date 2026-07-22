---
title: Understand your report
description: Turn Arcovia findings into a practical improvement plan.
---

Every analysis produces a terminal summary plus two artifacts: a self-contained HTML report and a machine-readable JSON report.

## Start with architecture health

The report opens with a score out of 100 and a letter grade. Treat it as a directional health signal, not a vanity metric. The score calculation is visible, so you can see how category deductions, maintenance burden, and critical risk contributed.

## Review findings and hotspots

Findings include the affected location, evidence, severity, and recommendation. Hotspots group the areas where several issues concentrate; these are often a better starting point than isolated low-impact warnings.

## Use the dependency graph

The graph separates your modules from external packages. Use it to investigate tight coupling, unexpected connections, circular dependencies, and high fan-in or fan-out modules.

## Create a baseline

Arcovia archives previous analysis artifacts in `.arcovia-report/history`. Run it regularly—locally or in CI—to make architectural progress visible through the timeline.

![Arcovia report showing architecture health, findings, and a dependency graph](/arcovia/images/banner.png)
