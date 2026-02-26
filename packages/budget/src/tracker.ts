import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  TokenUsage,
  BudgetLimits,
  BudgetStatus,
  BudgetEvent,
  BudgetEventHandler,
  ModelPricing,
} from './types.js';
import { DEFAULT_LIMITS, MODEL_PRICING } from './types.js';

const BUDGET_DIR = join(homedir(), '.vibepity', 'budget');
const LIMITS_FILE = join(BUDGET_DIR, 'limits.json');

function getDailyFile(): string {
  const today = new Date().toISOString().split('T')[0];
  return join(BUDGET_DIR, `usage-${today}.jsonl`);
}

function getMonthlyDir(): string {
  return BUDGET_DIR;
}

/**
 * Token Budget Manager - tracks usage and enforces limits.
 *
 * Solves OpenClaw's #1 user complaint: unexpected cost explosions.
 * Tracks per-request, per-session, per-day, per-month usage with
 * configurable limits, warnings, and hard blocks.
 */
export class BudgetTracker {
  private sessionUsage: TokenUsage[] = [];
  private dailyUsage: TokenUsage[] = [];
  private limits: BudgetLimits;
  private listeners: BudgetEventHandler[] = [];
  private sessionId: string;
  private initialized = false;

  constructor(limits?: Partial<BudgetLimits>) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.sessionId = `session_${Date.now().toString(36)}`;
  }

  /**
   * Load persisted limits and today's usage.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await mkdir(BUDGET_DIR, { recursive: true });

    // Load saved limits
    if (existsSync(LIMITS_FILE)) {
      try {
        const raw = await readFile(LIMITS_FILE, 'utf-8');
        const saved = JSON.parse(raw) as Partial<BudgetLimits>;
        this.limits = { ...this.limits, ...saved };
      } catch {
        // Use defaults
      }
    }

    // Load today's usage
    const dailyFile = getDailyFile();
    if (existsSync(dailyFile)) {
      try {
        const raw = await readFile(dailyFile, 'utf-8');
        const lines = raw.trim().split('\n').filter(Boolean);
        this.dailyUsage = lines.map(l => JSON.parse(l) as TokenUsage);
      } catch {
        this.dailyUsage = [];
      }
    }

    this.initialized = true;
  }

  /**
   * Register an event handler.
   */
  on(handler: BudgetEventHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter(h => h !== handler);
    };
  }

  private emit(event: BudgetEvent): void {
    for (const handler of this.listeners) {
      try { handler(event); } catch { /* listener errors don't propagate */ }
    }
  }

  /**
   * Estimate cost for a given model and token count.
   */
  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.getPricing(model);
    return (inputTokens * pricing.inputPer1M + outputTokens * pricing.outputPer1M) / 1_000_000;
  }

  /**
   * Check if a request with estimated tokens would be allowed.
   * Returns null if OK, or an error message if blocked.
   */
  checkBefore(model: string, estimatedInputTokens: number, estimatedOutputTokens: number): string | null {
    const totalTokens = estimatedInputTokens + estimatedOutputTokens;

    // Per-request limit
    if (this.limits.perRequest > 0 && totalTokens > this.limits.perRequest) {
      return `Request would use ~${totalTokens} tokens (limit: ${this.limits.perRequest})`;
    }

    // Per-session limit
    if (this.limits.perSession > 0) {
      const sessionTotal = this.getSessionTokens() + totalTokens;
      if (sessionTotal > this.limits.perSession) {
        return `Session would reach ${sessionTotal} tokens (limit: ${this.limits.perSession})`;
      }
    }

    // Per-day limit
    if (this.limits.perDay > 0) {
      const dayTotal = this.getDailyTokens() + totalTokens;
      if (dayTotal > this.limits.perDay) {
        return `Daily limit would be exceeded: ${dayTotal} tokens (limit: ${this.limits.perDay})`;
      }
    }

    // Daily cost limit
    if (this.limits.maxDailyCostUsd > 0) {
      const estimatedCost = this.estimateCost(model, estimatedInputTokens, estimatedOutputTokens);
      const dayCost = this.getDailyCost() + estimatedCost;
      if (dayCost > this.limits.maxDailyCostUsd) {
        return `Daily cost would be $${dayCost.toFixed(4)} (limit: $${this.limits.maxDailyCostUsd})`;
      }
    }

    return null;
  }

  /**
   * Record token usage after a request completes.
   */
  async record(model: string, inputTokens: number, outputTokens: number): Promise<TokenUsage> {
    await this.init();

    const costUsd = this.estimateCost(model, inputTokens, outputTokens);
    const usage: TokenUsage = {
      timestamp: Date.now(),
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd: costUsd,
      sessionId: this.sessionId,
    };

    this.sessionUsage.push(usage);
    this.dailyUsage.push(usage);

    // Persist to daily file
    const dailyFile = getDailyFile();
    const line = JSON.stringify(usage) + '\n';
    const existing = existsSync(dailyFile) ? await readFile(dailyFile, 'utf-8') : '';
    await writeFile(dailyFile, existing + line, 'utf-8');

    this.emit({ type: 'usage', usage });

    // Check warnings
    this.checkWarnings();

    return usage;
  }

  /**
   * Get current budget status.
   */
  async getStatus(): Promise<BudgetStatus> {
    await this.init();

    const session = this.aggregateUsage(this.sessionUsage);
    const daily = this.aggregateUsage(this.dailyUsage);
    const monthly = await this.getMonthlyAggregate();

    const warnings: string[] = [];
    const threshold = this.limits.warningThreshold;

    // Check daily token warning
    if (this.limits.perDay > 0) {
      const ratio = (daily.inputTokens + daily.outputTokens) / this.limits.perDay;
      if (ratio >= threshold) {
        warnings.push(`Daily tokens at ${(ratio * 100).toFixed(0)}% (${daily.inputTokens + daily.outputTokens}/${this.limits.perDay})`);
      }
    }

    // Check daily cost warning
    if (this.limits.maxDailyCostUsd > 0) {
      const ratio = daily.costUsd / this.limits.maxDailyCostUsd;
      if (ratio >= threshold) {
        warnings.push(`Daily cost at ${(ratio * 100).toFixed(0)}% ($${daily.costUsd.toFixed(4)}/$${this.limits.maxDailyCostUsd})`);
      }
    }

    // Check monthly cost warning
    if (this.limits.maxMonthlyCostUsd > 0) {
      const ratio = monthly.costUsd / this.limits.maxMonthlyCostUsd;
      if (ratio >= threshold) {
        warnings.push(`Monthly cost at ${(ratio * 100).toFixed(0)}% ($${monthly.costUsd.toFixed(4)}/$${this.limits.maxMonthlyCostUsd})`);
      }
    }

    // Check if blocked
    let blocked = false;
    let blockReason: string | undefined;

    if (this.limits.perDay > 0 && (daily.inputTokens + daily.outputTokens) >= this.limits.perDay) {
      blocked = true;
      blockReason = 'Daily token limit reached';
    }
    if (this.limits.maxDailyCostUsd > 0 && daily.costUsd >= this.limits.maxDailyCostUsd) {
      blocked = true;
      blockReason = 'Daily cost limit reached';
    }
    if (this.limits.maxMonthlyCostUsd > 0 && monthly.costUsd >= this.limits.maxMonthlyCostUsd) {
      blocked = true;
      blockReason = 'Monthly cost limit reached';
    }

    return { session, daily, monthly, limits: this.limits, warnings, blocked, blockReason };
  }

  /**
   * Update budget limits.
   */
  async setLimits(updates: Partial<BudgetLimits>): Promise<BudgetLimits> {
    await this.init();
    this.limits = { ...this.limits, ...updates };
    await mkdir(BUDGET_DIR, { recursive: true });
    await writeFile(LIMITS_FILE, JSON.stringify(this.limits, null, 2), 'utf-8');
    return this.limits;
  }

  /**
   * Reset session counters.
   */
  resetSession(): void {
    this.sessionUsage = [];
    this.sessionId = `session_${Date.now().toString(36)}`;
    this.emit({ type: 'reset', scope: 'session' });
  }

  /**
   * Get model pricing (returns zero-cost for Codex OAuth models).
   */
  getPricing(model: string): ModelPricing {
    // Exact match
    if (MODEL_PRICING[model]) return MODEL_PRICING[model];

    // Prefix match (e.g., "gpt-5.1-codex-mini" matches "gpt-5.1-codex")
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (model.startsWith(key)) return pricing;
    }

    // Unknown model - assume moderate pricing
    return { inputPer1M: 1.00, outputPer1M: 4.00 };
  }

  // ─── Private helpers ───────────────────────────────────────

  private getSessionTokens(): number {
    return this.sessionUsage.reduce((sum, u) => sum + u.inputTokens + u.outputTokens, 0);
  }

  private getDailyTokens(): number {
    return this.dailyUsage.reduce((sum, u) => sum + u.inputTokens + u.outputTokens, 0);
  }

  private getDailyCost(): number {
    return this.dailyUsage.reduce((sum, u) => sum + u.estimatedCostUsd, 0);
  }

  private aggregateUsage(usages: TokenUsage[]): {
    inputTokens: number; outputTokens: number; costUsd: number; requests: number;
  } {
    return usages.reduce(
      (acc, u) => ({
        inputTokens: acc.inputTokens + u.inputTokens,
        outputTokens: acc.outputTokens + u.outputTokens,
        costUsd: acc.costUsd + u.estimatedCostUsd,
        requests: acc.requests + 1,
      }),
      { inputTokens: 0, outputTokens: 0, costUsd: 0, requests: 0 },
    );
  }

  private async getMonthlyAggregate(): Promise<{
    inputTokens: number; outputTokens: number; costUsd: number; requests: number;
  }> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dir = getMonthlyDir();

    if (!existsSync(dir)) {
      return { inputTokens: 0, outputTokens: 0, costUsd: 0, requests: 0 };
    }

    const { readdir } = await import('node:fs/promises');
    const files = await readdir(dir);
    const monthFiles = files.filter(f => f.startsWith(`usage-${yearMonth}`) && f.endsWith('.jsonl'));

    let total = { inputTokens: 0, outputTokens: 0, costUsd: 0, requests: 0 };

    for (const file of monthFiles) {
      try {
        const raw = await readFile(join(dir, file), 'utf-8');
        const lines = raw.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          const u = JSON.parse(line) as TokenUsage;
          total.inputTokens += u.inputTokens;
          total.outputTokens += u.outputTokens;
          total.costUsd += u.estimatedCostUsd;
          total.requests += 1;
        }
      } catch {
        // Skip corrupt files
      }
    }

    return total;
  }

  private checkWarnings(): void {
    const threshold = this.limits.warningThreshold;

    if (this.limits.perDay > 0) {
      const ratio = this.getDailyTokens() / this.limits.perDay;
      if (ratio >= threshold && ratio < 1.0) {
        this.emit({
          type: 'warning',
          message: `Daily token usage at ${(ratio * 100).toFixed(0)}%`,
          percentage: ratio * 100,
        });
      }
      if (ratio >= 1.0) {
        this.emit({ type: 'blocked', reason: 'Daily token limit reached' });
      }
    }

    if (this.limits.maxDailyCostUsd > 0) {
      const ratio = this.getDailyCost() / this.limits.maxDailyCostUsd;
      if (ratio >= threshold && ratio < 1.0) {
        this.emit({
          type: 'warning',
          message: `Daily cost at ${(ratio * 100).toFixed(0)}%`,
          percentage: ratio * 100,
        });
      }
      if (ratio >= 1.0) {
        this.emit({ type: 'blocked', reason: 'Daily cost limit reached' });
      }
    }
  }
}
