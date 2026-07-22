import { Severity } from "../domain/index.js";

import type { PolicyDefinition } from "./policy.js";

/** Conservative starter boundaries supplied when no project policy file exists. */
export const RECOMMENDED_POLICY_PRESET: readonly PolicyDefinition[] = [
  {
    description: "UI modules must not import server modules directly.",
    disallow: ["src/server/**"],
    from: ["src/components/**", "src/app/**"],
    id: "no-server-imports",
    recommendation: "Move server logic behind an API or shared abstraction.",
    severity: Severity.Error,
  },
];
