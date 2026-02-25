import React, { useState } from 'react';
import { ChatPage } from './pages/Chat';
import { SettingsPage } from './pages/Settings';
import { BudgetPage } from './pages/Budget';
import { SkillsPage } from './pages/Skills';

type Page = 'chat' | 'budget' | 'skills' | 'settings';

const NAV_ITEMS: Array<{ id: Page; label: string; icon: string }> = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'budget', label: 'Budget', icon: '💰' },
  { id: 'skills', label: 'Skills', icon: '🔧' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function App() {
  const [page, setPage] = useState<Page>('chat');

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220,
        background: '#111',
        borderRight: '1px solid #2a2a2a',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 0',
      }}>
        <div style={{
          padding: '0 20px 20px',
          borderBottom: '1px solid #2a2a2a',
          marginBottom: 8,
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>VibeClaw AI</h1>
          <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Your Free AI Assistant</p>
        </div>

        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              background: page === item.id ? '#1a1a2e' : 'transparent',
              color: page === item.id ? '#8b5cf6' : '#888',
              border: 'none',
              textAlign: 'left',
              fontSize: 14,
              borderLeft: page === item.id ? '3px solid #8b5cf6' : '3px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        <div style={{ marginTop: 'auto', padding: '16px 20px', color: '#444', fontSize: 11 }}>
          v0.2.0 | MIT License
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {page === 'chat' && <ChatPage />}
        {page === 'budget' && <BudgetPage />}
        {page === 'skills' && <SkillsPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
