const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Chat
  chat: (message: string) =>
    request<{ text: string; model: string; mode: string; usage?: { inputTokens: number; outputTokens: number }; budgetWarnings?: string[] }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  clearChat: () => request('/chat/clear', { method: 'POST' }),

  // Auth
  getAuthStatus: () =>
    request<Record<string, { authenticated: boolean; remainingMinutes: number }>>('/auth/status'),
  login: (provider: string) =>
    request('/auth/login/' + provider, { method: 'POST' }),

  // Budget
  getBudget: () => request<{
    session: { inputTokens: number; outputTokens: number; costUsd: number; requests: number };
    daily: { inputTokens: number; outputTokens: number; costUsd: number; requests: number };
    monthly: { inputTokens: number; outputTokens: number; costUsd: number; requests: number };
    limits: Record<string, number>;
    warnings: string[];
    blocked: boolean;
  }>('/budget'),
  setBudget: (limits: Record<string, number>) =>
    request('/budget/set', { method: 'POST', body: JSON.stringify(limits) }),

  // Skills
  getSkills: () => request<Array<{ name: string; title: string; description: string; security?: { level: string; riskScore: number } }>>('/skills'),
  installSkill: (name: string) =>
    request('/skills/install', { method: 'POST', body: JSON.stringify({ name }) }),
  scanSkills: () => request('/skills/scan', { method: 'POST' }),
  removeSkill: (name: string) =>
    request(`/skills/${name}`, { method: 'DELETE' }),

  // Config
  getConfig: () => request<Record<string, unknown>>('/config'),
  setConfig: (updates: Record<string, unknown>) =>
    request('/config', { method: 'POST', body: JSON.stringify(updates) }),

  // Workspace
  getWorkspaceStatus: () => request<{ initialized: boolean }>('/workspace/status'),
  initWorkspace: () => request('/workspace/init', { method: 'POST' }),

  // Health
  health: () => request<{ status: string }>('/health'),
};
