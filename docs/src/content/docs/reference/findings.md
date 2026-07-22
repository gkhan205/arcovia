---
title: Findings
description: The architecture signals Arcovia evaluates.
---

Arcovia looks for signals that make a React or Next.js codebase harder to understand, change, and scale.

## Architecture and dependencies

- Circular module dependencies
- Orphan modules
- Deep dependency chains
- High fan-in and fan-out modules
- God modules

## Imports and exports

- Duplicate imports
- Unused internal exports
- Boundary violations from configured architecture policies

## Components and complexity

- Large components
- Deeply nested JSX
- Complexity and maintainability signals

## Framework awareness

Framework-aware behavior avoids common Next.js false positives. Route handler methods such as `GET` and `POST`, route-page exports, and metadata exports including `generateMetadata`, `generateStaticParams`, and `revalidate` are handled as framework conventions.

Each reported finding includes its location, evidence, severity, and a recommendation. Use the report’s filters to focus on the category or severity that matters to the current improvement effort.
