---
title: Quick start
description: Analyze a React or Next.js project in a few seconds.
---

## 1. Run Arcovia from your project

From the root of a React or Next.js project, run:

```bash
npx arcovia analyze .
```

You can also install the CLI globally:

```bash
npm install -g arcovia
arcovia analyze .
```

## 2. Read the terminal summary

Arcovia prints the architecture score, grade, highest-priority findings, and the location of generated reports. Start with the score and hotspots, then open the HTML report for the complete view.

## 3. Open your reports

By default, Arcovia writes reports to `.arcovia-report`:

```text
.arcovia-report/
  analysis.json
  report.html
```

Open `report.html` in a browser. It is a portable, offline file you can share with your team.

## Choose an output directory

```bash
arcovia analyze . --output ./reports
```

Next, learn how to [read the report](../reports/).
