---
title: Understand your report
description: Turn Arcovia findings into a practical improvement plan.
---

Every analysis produces a terminal summary and two report artifacts:

- `report.html` is a portable, interactive report for people.
- `analysis.json` is a versioned artifact for automation, CI, and historical comparison.

By default, both files are written to `.arcovia-report`. Open `report.html` in any modern browser. It is self-contained, so you can share it without a server, account, or network connection.

## Start with architecture health

The report opens with an architecture score out of 100 and a letter grade. Use this as a health signal, not a target by itself. A score is useful because the report shows how it was calculated and which areas have the greatest effect on it.

Review these parts together:

- **Overall score and grade** show the current health of the project.
- **Category health** shows where deductions are concentrated, such as architecture, imports, components, or complexity.
- **Maintenance burden** reflects the combined effect of a large number of actionable findings.
- **Critical risk** shows the bounded adjustment for verified critical findings.

Do not assume that a high score means there is no important work left. A project can have a strong overall score while still containing one high-risk module or a costly circular dependency. Likewise, a lower score is a prioritization prompt, not a judgment on the team or codebase.

## Read the score calculation

Arcovia makes score contributors visible so that a team can discuss the evidence rather than debate an opaque number. Begin with the category that has the largest deduction, then inspect the findings behind it.

Repeated findings use diminishing penalties, and certain hygiene rules have caps. This prevents a large number of near-identical warnings from dominating the final result. Estimated score recovery shown in hotspots, quick wins, and roadmap items is a planning estimate. It is not a guarantee of the final score after a refactor.

For a complete explanation of weights and grades, see the [scoring reference](../../reference/scoring/).

## Review findings

Each finding contains the information needed to decide whether to act:

- **Location** identifies the affected file and, when available, the relevant source line.
- **Evidence** explains what Arcovia observed.
- **Severity** helps you distinguish informational debt from warnings and errors.
- **Recommendation** gives a suggested next step.

Use the report filters to narrow the list by severity, category, or rule. A useful review session starts with errors and warnings, then considers whether a group of informational findings reveals a broader pattern.

When a finding is not actionable, verify that it reflects a real exception before dismissing it. If the exception represents an intentional architectural boundary, consider capturing that decision in a [custom policy rule](../custom-policy-rules/).

## Use hotspots and quick wins

Hotspots group files and modules where architectural issues are concentrated. They are usually a better starting point than isolated low-impact warnings because one refactor can resolve several findings at once.

Quick wins identify smaller changes that are likely to improve maintainability with limited risk. Use them to create momentum, but do not let them distract from a hotspot that is blocking safe product work.

A practical prioritization order is:

1. Resolve critical findings and broken boundaries.
2. Investigate the highest-impact hotspots.
3. Address quick wins that support the same architectural direction.
4. Re-run Arcovia and verify that the change improved the intended category.

## Explore the dependency graph

The dependency graph separates project modules from external packages. It helps you understand how changes travel through the codebase.

Use the graph to investigate:

- Circular dependencies that make module initialization and refactoring harder.
- High fan-in modules that many other modules depend on.
- High fan-out modules that depend on too many unrelated areas.
- Unexpected links between features, layers, or shared code.
- External dependencies that are concentrated around a small part of the application.

When you find an unexpected relationship, select the connected module and read the associated findings before changing code. The graph shows structure; the findings explain why the structure matters.

## Follow the roadmap

The report turns the most relevant findings into a short refactoring roadmap. Treat this as a starting point for planning. Each item links a concrete architectural concern with the affected area and a suggested direction for improvement.

Before assigning an item, confirm the affected feature is actively maintained and identify any ownership or release constraints. A good roadmap item is small enough to validate after one change, but meaningful enough to improve a category or remove a recurring source of risk.

## Create a baseline and track progress

Arcovia archives earlier analysis artifacts in `.arcovia-report/history`. Run it regularly, either locally or in CI, to make architectural change visible over time.

Use the timeline to answer practical questions:

- Did a refactor improve the category it was intended to improve?
- Did a feature release introduce new coupling or complexity?
- Is maintenance burden falling as planned?
- Which categories have remained unchanged for several reporting cycles?

Compare reports from similar branches or release points. A single run describes the current state; a sequence of runs shows whether the architecture is becoming easier or harder to change.

## Use the JSON artifact in automation

`analysis.json` contains the machine-readable analysis result. Store it as a CI artifact, archive it with release metadata, or use it in internal tooling. The JSON report is useful when you want to track score trends, build dashboards, or enforce a team-defined quality threshold without parsing terminal output.

The HTML report is best for exploration and discussion. The JSON artifact is best for systems and repeatable checks. Keeping both gives a team a shared visual view and a reliable automation input.
