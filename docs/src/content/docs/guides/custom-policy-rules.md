---
title: Custom policy rules
description: Define and enforce project-specific module boundaries with .arcovia.json.
---

Custom policy rules let your team encode architectural boundaries in version control. Arcovia evaluates them against resolved local imports and reports violations alongside its built-in findings.

Available in Arcovia `v0.2.0` and later.

## Quick start

Create `.arcovia.json` in the project root:

```json
{
  "extends": ["arcovia:recommended"],
  "policies": [
    {
      "id": "no-server-imports",
      "description": "UI cannot import server modules",
      "from": ["src/components/**", "src/app/**"],
      "disallow": ["src/server/**"],
      "severity": "error",
      "recommendation": "Move server logic behind an API or shared abstraction."
    }
  ]
}
```

Run Arcovia normally:

```bash
npx arcovia analyze .
```

If a matching component imports a server module, Arcovia creates an `architecture-policy` finding at that import statement.

## Policy fields

| Field | Required | Purpose |
| --- | --- | --- |
| `id` | Yes | Unique, stable kebab-case identifier. |
| `description` | Yes | Explains the boundary to your team. |
| `from` | Yes | Project-relative source glob patterns. |
| `allow` | One mode | Only these local destinations may be imported. |
| `disallow` | One mode | These local destinations may not be imported. |
| `severity` | Yes | `info`, `warning`, or `error`. |
| `recommendation` | No | Remediation text shown with violations. |
| `enabled` | No | Set to `false` to disable an inherited policy. |

Use exactly one of `allow` or `disallow`.

## Common patterns

### Layer boundaries

```json
{
  "id": "ui-to-server",
  "description": "UI modules must not access server modules directly",
  "from": ["src/ui/**"],
  "disallow": ["src/server/**"],
  "severity": "error"
}
```

### Feature boundaries

```json
{
  "id": "orders-users-boundary",
  "description": "Orders must not depend on Users implementation details",
  "from": ["src/features/orders/**"],
  "disallow": ["src/features/users/**"],
  "severity": "warning"
}
```

### Shared modules only

`allow` is a strict local-destination allowlist.

```json
{
  "id": "feature-shared-only",
  "description": "Features communicate through shared modules",
  "from": ["src/features/**"],
  "allow": ["src/shared/**"],
  "severity": "warning"
}
```

## Presets and overrides

`extends` adds a policy baseline. A project policy with the same `id` replaces that preset policy; a new ID is added alongside it.

To disable an inherited policy:

```json
{
  "extends": ["arcovia:recommended"],
  "policies": [{ "id": "no-server-imports", "enabled": false }]
}
```

Without `.arcovia.json`, Arcovia runs its built-in rules but no policy preset. With a configuration file and no `extends`, only policies declared in that file are evaluated.

## Matching and reporting

Patterns match normalized, project-relative paths using forward slashes. Arcovia resolves local relative imports and supported aliases before evaluating a policy, so equivalent import spellings point to the same target.

Static imports and re-exports are evaluated. External packages, unresolved imports, dynamic imports, and advanced aliases are outside this policy contract.

Each violation contains the policy ID, source and resolved target paths, severity, and optional recommendation. Policy status is summarized in the CLI and HTML report.

## Invalid configuration

Arcovia stops before analysis when configuration is invalid for example malformed JSON, duplicate IDs after merging, invalid severity values, empty pattern lists, or policies defining both `allow` and `disallow`.
