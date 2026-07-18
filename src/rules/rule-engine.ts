import type { Finding } from "../domain/index.js";

import { FindingCollector } from "./finding-collector.js";
import type { RuleContext } from "./rule.js";
import { RuleExecutor } from "./rule-executor.js";
import type { RuleRegistry } from "./rule-registry.js";
import { RuleScheduler } from "./rule-scheduler.js";

/** Coordinates rule registration, scheduling, isolated execution, and collection. */
export class RuleEngine {
  public constructor(
    private readonly registry: RuleRegistry,
    private readonly scheduler = new RuleScheduler(),
    private readonly executor = new RuleExecutor(),
    private readonly collector = new FindingCollector(),
  ) {}

  /** Runs all enabled compatible rules and returns normalized findings only. */
  public async execute(context: RuleContext): Promise<readonly Finding[]> {
    const scheduledRules = this.scheduler.schedule(this.registry.getAll(), context);
    const results = await this.executor.execute(scheduledRules, context);
    return this.collector.collect(results);
  }
}
