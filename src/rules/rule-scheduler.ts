import type { Severity } from "../domain/index.js";

import type { Rule, RuleContext, RuleLevel, RuleSetting } from "./rule.js";

/** A rule selected for execution with its effective severity. */
export interface ScheduledRule {
  readonly rule: Rule;
  readonly severity: Severity;
}

/** Selects enabled, compatible rules in deterministic order. */
export class RuleScheduler {
  /** Prepares an execution plan without running rules. */
  public schedule(rules: readonly Rule[], context: RuleContext): readonly ScheduledRule[] {
    return rules
      .filter((rule) => supportsRule(rule, context))
      .flatMap((rule) => {
        const level = getRuleLevel(context.configuration.rules[rule.id]) ?? rule.defaultSeverity;
        return level === "off" ? [] : [{ rule, severity: severityFromLevel(level) }];
      })
      .sort((left, right) => left.rule.id.localeCompare(right.rule.id));
  }
}

/** Resolves a rule's configured severity when present. */
export function getRuleLevel(setting: RuleSetting | undefined): RuleLevel | undefined {
  return typeof setting === "string" ? setting : setting?.severity;
}

function supportsRule(rule: Rule, context: RuleContext): boolean {
  try {
    return rule.supports(context);
  } catch {
    context.logger.warn(`Rule support check failed: ${rule.id}`);
    return false;
  }
}

function severityFromLevel(level: Exclude<RuleLevel, "off">): Severity {
  return level;
}
