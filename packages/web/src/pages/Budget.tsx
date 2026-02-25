import React, { useEffect, useState } from 'react';
import { api } from '../api';

export function BudgetPage() {
  const [budget, setBudget] = useState<{
    session: { inputTokens: number; outputTokens: number; costUsd: number; requests: number };
    daily: { inputTokens: number; outputTokens: number; costUsd: number; requests: number };
    monthly: { inputTokens: number; outputTokens: number; costUsd: number; requests: number };
    limits: Record<string, number>;
    warnings: string[];
    blocked: boolean;
  } | null>(null);

  useEffect(() => {
    api.getBudget().then(setBudget).catch(console.error);
  }, []);

  if (!budget) return <div style={{ padding: 32, color: '#666' }}>Loading...</div>;

  const StatCard = ({ label, tokens, cost, requests }: { label: string; tokens: number; cost: number; requests: number }) => (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#8b5cf6' }}>{tokens.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: '#666' }}>tokens</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, fontSize: 13 }}>
        <span style={{ color: '#4ade80' }}>${cost.toFixed(4)}</span>
        <span style={{ color: '#888' }}>{requests} requests</span>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Token Budget</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Session" tokens={budget.session.inputTokens + budget.session.outputTokens} cost={budget.session.costUsd} requests={budget.session.requests} />
        <StatCard label="Today" tokens={budget.daily.inputTokens + budget.daily.outputTokens} cost={budget.daily.costUsd} requests={budget.daily.requests} />
        <StatCard label="This Month" tokens={budget.monthly.inputTokens + budget.monthly.outputTokens} cost={budget.monthly.costUsd} requests={budget.monthly.requests} />
      </div>

      {/* Limits */}
      <div className="card">
        <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12 }}>Limits</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
          <div>Daily tokens: <strong>{budget.limits.perDay?.toLocaleString() || 'unlimited'}</strong></div>
          <div>Monthly tokens: <strong>{budget.limits.perMonth?.toLocaleString() || 'unlimited'}</strong></div>
          <div>Daily cost: <strong>${budget.limits.maxDailyCostUsd || 'unlimited'}</strong></div>
          <div>Monthly cost: <strong>${budget.limits.maxMonthlyCostUsd || 'unlimited'}</strong></div>
        </div>
      </div>

      {/* Warnings */}
      {budget.warnings.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {budget.warnings.map((w, i) => (
            <div key={i} style={{ padding: '8px 16px', background: '#332800', border: '1px solid #554400', borderRadius: 8, color: '#facc15', fontSize: 13, marginBottom: 8 }}>
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}

      {budget.blocked && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#330000', border: '1px solid #550000', borderRadius: 8, color: '#f87171', fontSize: 14 }}>
          🚫 Budget limit reached. Requests are blocked.
        </div>
      )}
    </div>
  );
}
