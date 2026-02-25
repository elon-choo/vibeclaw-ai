/** Model pricing per 1M tokens (USD) */
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  /** Cached input pricing (if applicable) */
  cachedInputPer1M?: number;
}

/** Known model pricing table */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Codex models (via ChatGPT subscription = $0 marginal cost)
  'gpt-5.1-codex': { inputPer1M: 0, outputPer1M: 0 },
  'gpt-5.1-codex-mini': { inputPer1M: 0, outputPer1M: 0 },
  // Direct API models (pay-per-token)
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gpt-4.1': { inputPer1M: 2.00, outputPer1M: 8.00 },
  'gpt-4.1-mini': { inputPer1M: 0.40, outputPer1M: 1.60 },
  'gpt-4.1-nano': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'o3-mini': { inputPer1M: 1.10, outputPer1M: 4.40 },
  // Claude models
  'claude-sonnet-4-6': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-opus-4-6': { inputPer1M: 15.00, outputPer1M: 75.00 },
  'claude-haiku-4-5': { inputPer1M: 0.80, outputPer1M: 4.00 },
};

/** Token usage record for a single request */
export interface TokenUsage {
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Estimated cost in USD */
  estimatedCostUsd: number;
  /** Session ID */
  sessionId?: string;
}

/** Budget limits configuration */
export interface BudgetLimits {
  /** Max tokens per single request (0 = unlimited) */
  perRequest: number;
  /** Max tokens per session (0 = unlimited) */
  perSession: number;
  /** Max tokens per day (0 = unlimited) */
  perDay: number;
  /** Max tokens per month (0 = unlimited) */
  perMonth: number;
  /** Max estimated cost per day in USD (0 = unlimited) */
  maxDailyCostUsd: number;
  /** Max estimated cost per month in USD (0 = unlimited) */
  maxMonthlyCostUsd: number;
  /** Warning threshold (0.0-1.0, triggers warning at this % of limit) */
  warningThreshold: number;
}

/** Budget status snapshot */
export interface BudgetStatus {
  /** Current session totals */
  session: { inputTokens: number; outputTokens: number; costUsd: number; requests: number };
  /** Today's totals */
  daily: { inputTokens: number; outputTokens: number; costUsd: number; requests: number };
  /** This month's totals */
  monthly: { inputTokens: number; outputTokens: number; costUsd: number; requests: number };
  /** Active limits */
  limits: BudgetLimits;
  /** Warnings (approaching limit) */
  warnings: string[];
  /** Whether the next request would be blocked */
  blocked: boolean;
  blockReason?: string;
}

/** Budget event types */
export type BudgetEvent =
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'warning'; message: string; percentage: number }
  | { type: 'blocked'; reason: string }
  | { type: 'reset'; scope: 'session' | 'daily' | 'monthly' };

export type BudgetEventHandler = (event: BudgetEvent) => void;

export const DEFAULT_LIMITS: BudgetLimits = {
  perRequest: 0,
  perSession: 0,
  perDay: 500_000,
  perMonth: 10_000_000,
  maxDailyCostUsd: 5.00,
  maxMonthlyCostUsd: 50.00,
  warningThreshold: 0.8,
};
