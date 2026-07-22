---
title: Scoring
description: How Arcovia turns observed architecture findings into a health score.
---

Arcovia begins at 100, then applies category deductions, a capped maintenance-burden adjustment, and a bounded critical-risk adjustment. The final score is explainable in the report.

```text
100
− category deductions
− maintenance-burden adjustment
− critical-risk adjustment
= final architecture score
```

## Category weights

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

Repeated findings use diminishing penalties, and certain hygiene rules have caps. This keeps a large number of similar signals from overwhelming the score.

## Grades

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

An estimated recovery shown in a hotspot or roadmap item is a planning estimate, not a promise of the final score after a refactor.
