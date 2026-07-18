import { ArcoviaError } from "../errors/index.js";

import type { Rule } from "./rule.js";

/** Stores registered rules without executing them. */
export class RuleRegistry {
  private readonly rules = new Map<string, Rule>();

  /** Registers a unique rule. */
  public register(rule: Rule): void {
    if (this.rules.has(rule.id)) {
      throw new DuplicateRuleIdError(rule.id);
    }
    this.rules.set(rule.id, rule);
  }

  /** Returns a rule by stable ID. */
  public get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  /** Returns all registered rules in deterministic order. */
  public getAll(): readonly Rule[] {
    return [...this.rules.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
}

/** Indicates a conflicting rule registration. */
export class DuplicateRuleIdError extends ArcoviaError {
  public constructor(id: string) {
    super(`Rule ID is already registered: ${id}`, "DUPLICATE_RULE_ID", [
      "Register each rule ID only once.",
    ]);
  }
}
