---
title: Architecture policies
description: Enforce project-specific module boundaries with .arcovia.json.
---

Architecture policies let you capture the boundaries your team expects, such as preventing UI modules from importing server code. Policies are evaluated as regular findings and appear in the terminal, JSON, and HTML reports.

## Quick start

Create an `.arcovia.json` file in the project root:

```json
{
  "policies": [
    {
      "name": "ui-does-not-import-server",
      "from": "src/components/**",
      "disallow": ["src/server/**"]
    }
  ]
}
```

Run `arcovia analyze .` as usual. Any boundary violation appears as a finding with the importing module, imported module, and policy name.

## Common policy patterns

- **Layered architecture:** prevent presentation, application, and data layers from crossing in the wrong direction.
- **Feature boundaries:** keep one feature from reaching into another feature's internals.
- **Shared modules:** require shared utilities to stay dependency-light and avoid importing feature code.

## Composition and overrides

Use `extends` to start from recommended policies, then add, override, or disable a policy for your project. Configuration errors are reported clearly rather than silently ignored.

See the repository’s [full policy specification](https://github.com/gkhan205/arcovia/blob/main/engineering-docs/architecture-policies.md) for fields, glob matching, precedence, and complete examples.
