# Architecture Policies

**Status:** Available. This document describes Arcovia's `.arcovia.json`
architecture-policy support.

Architecture policies let a team encode its own module-boundary decisions in
version control. Arcovia evaluates those decisions against the project's
resolved local import relationships and reports violations as normal findings.

For example, a team can ensure that UI code never imports server modules rather
than relying on a code-review convention to catch the problem.

## Quick start

Create `.arcovia.json` in the root of the project being analyzed:

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

Run Arcovia as usual:

```bash
npx arcovia analyze .
```

If `src/components/Button.tsx` imports `src/server/db.ts`, Arcovia reports an
architecture-policy finding at the import statement.

## Policy sources and precedence

Arcovia has two independent kinds of checks:

1. **Built-in Arcovia rules** are shipped with Arcovia. They always run and are
   not changed by this configuration.
2. **Architecture policies** are path-boundary rules loaded from presets and
   `.arcovia.json`.

Policies are resolved in this order:

```text
Arcovia built-in rules              always run, unchanged
Policies from `extends`             baseline policy packs
Policies in `.arcovia.json`         additive; replace matching preset IDs
```

A project policy with the same `id` as a policy from an extended preset replaces
that preset policy completely. Policies with new IDs are added alongside the
preset policies.

### No configuration file

When a project does not contain `.arcovia.json`, Arcovia runs its normal
built-in rules but no architecture-policy preset. The Policies report shows
**No policy preset configured**.

### Configuration with `extends`

Use `extends` to opt into one or more policy packs explicitly:

```json
{
  "extends": ["arcovia:recommended"],
  "policies": []
}
```

In the future, this list can also support organization-owned policy packages,
for example `@acme/arcovia-policies`.

### Configuration without `extends`

When `.arcovia.json` exists but does not define `extends`, Arcovia evaluates
only the policies declared in that file. Its built-in Arcovia rules still run.
This allows a team to use a completely project-specific policy set.

## Policy fields

Each policy must have a unique `id` within the final merged policy set.

| Field | Required | Description |
| --- | --- | --- |
| `id` | Yes | Stable, unique policy identifier. Use lowercase kebab case, such as `no-server-imports`. |
| `description` | Yes | Human-readable explanation of the boundary. |
| `from` | Yes | One or more project-relative glob patterns for source modules to which the policy applies. |
| `allow` | One of `allow` or `disallow` | Destination allowlist. Imports from matching sources may only target matching local destinations. |
| `disallow` | One of `allow` or `disallow` | Destination denylist. Imports from matching sources must not target matching local destinations. |
| `severity` | Yes | Finding severity: `info`, `warning`, or `error`. |
| `recommendation` | No | Remediation advice displayed with each violation. |
| `enabled` | No | Set to `false` to disable a policy inherited from a preset. |

`allow` and `disallow` are mutually exclusive in version 1. A policy must use
exactly one mode.

## Glob matching

Patterns are matched against normalized project-relative paths using forward
slashes, regardless of operating system.

```json
{
  "from": ["src/components/**"],
  "disallow": ["src/server/**"]
}
```

In this example, `src/components/Button.tsx` matches `from` and
`src/server/db.ts` matches `disallow`.

Paths must refer to source modules, not import-string spelling. Arcovia resolves
relative imports and supported local aliases first, so equivalent imports such as
`../server/db` and `@/server/db` are evaluated against the same target path.

## Examples

### Layered architecture

```json
{
  "id": "ui-to-server",
  "description": "UI modules must not access server modules directly",
  "from": ["src/ui/**"],
  "disallow": ["src/server/**"],
  "severity": "error"
}
```

### Feature boundary

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

`allow` is a strict local-destination allowlist. A source module matching
`from` may only import resolved local modules that match `allow`.

```json
{
  "id": "feature-shared-only",
  "description": "Features communicate through shared modules",
  "from": ["src/features/**"],
  "allow": ["src/shared/**"],
  "severity": "warning"
}
```

### Override a recommended policy

This replaces the policy named `no-server-imports` from
`arcovia:recommended`, while preserving every other policy in that preset.

```json
{
  "extends": ["arcovia:recommended"],
  "policies": [
    {
      "id": "no-server-imports",
      "description": "Components must not import server modules",
      "from": ["src/components/**"],
      "disallow": ["src/server/**"],
      "severity": "error"
    }
  ]
}
```

### Disable an inherited policy

Use the inherited policy ID and `enabled: false`:

```json
{
  "extends": ["arcovia:recommended"],
  "policies": [
    {
      "id": "no-server-imports",
      "enabled": false
    }
  ]
}
```

## What Arcovia evaluates

Version 1 evaluates resolved, project-local import relationships. It reports one
violation per import statement so the finding points to the exact source line.

- Static imports are evaluated.
- Re-export dependencies are evaluated.
- External package imports are not evaluated by path policies.
- Unresolved imports are not policy violations; Arcovia continues to report them
  through its dependency analysis.
- Dynamic imports and advanced aliases are outside the initial policy contract.

## Reporting and scoring

Policy violations are ordinary Arcovia findings with:

- rule: `architecture-policy`;
- the policy ID and description;
- source and resolved target module paths as evidence;
- the configured severity and recommendation.

The CLI and HTML report also summarize policy status, including passed and
failed policies, violation counts, and affected files.

They also show the active configuration clearly:

- **No policy preset configured** means no `.arcovia.json` was found and no
  architecture-policy preset is active.
- **Project policy configuration active** means `.arcovia.json` was found; the
  report lists any presets it extends.

Policy findings can affect the Architecture Health Score using policy-specific
weights. Default-policy scoring is kept separate from Arcovia's existing rule
scoring so adding a policy does not alter the meaning of existing built-in rule
weights.

## Configuration errors

Arcovia stops before analysis and explains the issue when a policy configuration
is invalid. Examples include malformed JSON, duplicate IDs after merging,
unknown severity values, empty pattern lists, and policies defining both `allow`
and `disallow`.

## Planned extensions

Potential future additions include regular expressions, tags and layers,
per-file exceptions, conditional policies, policy groups, custom messages, and
organization-wide shared policy packages.
