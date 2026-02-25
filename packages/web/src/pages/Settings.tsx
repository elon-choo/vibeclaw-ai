import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface AuthStatus {
  authenticated: boolean;
  remainingMinutes: number;
}

export function SettingsPage() {
  const [auth, setAuth] = useState<Record<string, AuthStatus>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const fetchAuth = async () => {
    try {
      const status = await api.getAuthStatus();
      setAuth(status);
    } catch (e) {
      console.error('Failed to fetch auth status:', e);
    }
  };

  useEffect(() => { fetchAuth(); }, []);

  const handleLogin = async (provider: string) => {
    setLoading(provider);
    try {
      await api.login(provider);
      // Poll for status update
      setTimeout(fetchAuth, 3000);
      setTimeout(fetchAuth, 10000);
      setTimeout(fetchAuth, 30000);
    } catch (e) {
      console.error('Login error:', e);
    } finally {
      setLoading(null);
    }
  };

  const providers = [
    { id: 'codex', name: 'ChatGPT (Codex)', desc: '$0 - ChatGPT Plus 구독 포함', color: '#4ade80', safe: true },
    { id: 'claude', name: 'Claude (Anthropic)', desc: '⚠️ 제3자 제한 가능', color: '#facc15', safe: false },
    { id: 'gemini', name: 'Gemini (Google)', desc: '⚠️ 계정 밴 위험', color: '#f87171', safe: false },
  ];

  return (
    <div style={{ padding: 32, maxWidth: 640 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Settings</h2>

      <h3 style={{ fontSize: 16, color: '#888', marginBottom: 16 }}>AI Provider Login</h3>

      {providers.map(p => {
        const status = auth[p.id];
        const isAuthenticated = status?.authenticated;

        return (
          <div key={p.id} className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{p.desc}</div>
              {isAuthenticated && (
                <div style={{ fontSize: 12, color: p.color, marginTop: 4 }}>
                  Authenticated ({status.remainingMinutes}min remaining)
                </div>
              )}
            </div>
            <button
              className={isAuthenticated ? 'btn btn-ghost' : 'btn btn-primary'}
              onClick={() => handleLogin(p.id)}
              disabled={loading === p.id}
              style={{ minWidth: 100 }}
            >
              {loading === p.id ? 'Opening...' : isAuthenticated ? 'Refresh' : 'Login'}
            </button>
          </div>
        );
      })}

      <div style={{ marginTop: 16, padding: 16, background: '#1a1a0a', border: '1px solid #333', borderRadius: 8, fontSize: 13, color: '#999' }}>
        <strong style={{ color: '#facc15' }}>Notice:</strong> Claude/Gemini OAuth는 각 회사 TOS에 따라 계정 제한 위험이 있습니다. Codex (ChatGPT) OAuth만 공식적으로 안전합니다.
      </div>
    </div>
  );
}
