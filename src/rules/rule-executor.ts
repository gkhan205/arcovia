import type { Finding } from "../domain/index.js";

import type { RuleContext } from "./rule.js";
import type { ScheduledRule } from "./rule-scheduler.js";

/** Outcome of executing one isolated rule. */
export interface RuleExecutionResult {
  readonly durationMs: number;
  readonly findings: readonly Finding[];
  readonly scheduledRule: ScheduledRule;
  readonly status: "completed" | "failed" | "timed-out";
}

/** Runs independent rules with bounded parallelism and failure isolation. */
export class RuleExecutor {
  /** Executes scheduled rules and returns one outcome per rule. */
  public async execute(
    scheduledRules: readonly ScheduledRule[],
    context: RuleContext,
  ): Promise<readonly RuleExecutionResult[]> {
    const results: RuleExecutionResult[] = new Array(scheduledRules.length);
    const concurrency = Math.max(1, context.configuration.concurrency ?? 4);
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (nextIndex < scheduledRules.length) {
        const index = nextIndex;
        nextIndex += 1;
        const scheduledRule = scheduledRules[index];
        if (scheduledRule !== undefined)
          results[index] = await this.executeRule(scheduledRule, context);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, scheduledRules.length) }, worker));
    return results;
  }

  private async executeRule(
    scheduledRule: ScheduledRule,
    context: RuleContext,
  ): Promise<RuleExecutionResult> {
    const startedAt = performance.now();
    const timeoutMs = context.configuration.timeoutMs ?? 2000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const execution = scheduledRule.rule
      .execute(context)
      .then((findings) => ({ findings }))
      .catch((error: unknown) => ({ error }));
    const timeout = new Promise<{ readonly timedOut: true }>((resolve) => {
      timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    });
    const outcome = await Promise.race([execution, timeout]);
    if (timer !== undefined) clearTimeout(timer);
    const durationMs = performance.now() - startedAt;

    if ("timedOut" in outcome) {
      context.logger.warn(`Rule timed out: ${scheduledRule.rule.id}`);
      return { durationMs, findings: [], scheduledRule, status: "timed-out" };
    }
    if ("error" in outcome || !Array.isArray(outcome.findings)) {
      context.logger.warn(`Rule failed: ${scheduledRule.rule.id}`);
      return { durationMs, findings: [], scheduledRule, status: "failed" };
    }
    return { durationMs, findings: outcome.findings, scheduledRule, status: "completed" };
  }
}
