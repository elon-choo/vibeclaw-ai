import { ui } from '../ui.js';

export async function budgetStatus(): Promise<void> {
  const { BudgetTracker } = await import('@vibeclaw-ai/budget');
  const tracker = new BudgetTracker();
  const status = await tracker.getStatus();

  ui.header('  Token Budget Status\n');

  ui.summary([
    { label: 'Session', value: `${status.session.inputTokens + status.session.outputTokens} tokens | $${status.session.costUsd.toFixed(4)} | ${status.session.requests} requests` },
    { label: 'Today', value: `${status.daily.inputTokens + status.daily.outputTokens} tokens | $${status.daily.costUsd.toFixed(4)} | ${status.daily.requests} requests` },
    { label: 'Month', value: `${status.monthly.inputTokens + status.monthly.outputTokens} tokens | $${status.monthly.costUsd.toFixed(4)} | ${status.monthly.requests} requests` },
  ]);

  console.log('');

  ui.summary([
    { label: 'Daily limit', value: status.limits.perDay > 0 ? `${status.limits.perDay} tokens / $${status.limits.maxDailyCostUsd}` : 'unlimited' },
    { label: 'Monthly limit', value: status.limits.perMonth > 0 ? `${status.limits.perMonth} tokens / $${status.limits.maxMonthlyCostUsd}` : 'unlimited' },
    { label: 'Warning at', value: `${(status.limits.warningThreshold * 100).toFixed(0)}%` },
  ]);

  if (status.warnings.length > 0) {
    console.log('');
    for (const w of status.warnings) {
      ui.warn(w);
    }
  }

  if (status.blocked) {
    console.log('');
    ui.error(`BLOCKED: ${status.blockReason}`);
  }
}

export async function budgetSet(args: string[]): Promise<void> {
  const { BudgetTracker } = await import('@vibeclaw-ai/budget');
  const tracker = new BudgetTracker();

  const updates: Record<string, number> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = parseInt(args[i + 1], 10);
    if (isNaN(value)) {
      ui.error(`Invalid value for ${key}: ${args[i + 1]}`);
      return;
    }

    switch (key) {
      case '--daily-tokens': updates['perDay'] = value; break;
      case '--monthly-tokens': updates['perMonth'] = value; break;
      case '--daily-cost': updates['maxDailyCostUsd'] = value; break;
      case '--monthly-cost': updates['maxMonthlyCostUsd'] = value; break;
      case '--per-request': updates['perRequest'] = value; break;
      case '--per-session': updates['perSession'] = value; break;
      default:
        ui.error(`Unknown option: ${key}`);
        ui.info('Options: --daily-tokens, --monthly-tokens, --daily-cost, --monthly-cost, --per-request, --per-session');
        return;
    }
  }

  if (Object.keys(updates).length === 0) {
    ui.info('Usage: vibeclaw-ai budget set --daily-tokens 500000 --daily-cost 5');
    return;
  }

  const limits = await tracker.setLimits(updates);
  ui.success('Budget limits updated');
  ui.dim(JSON.stringify(limits, null, 2));
}
