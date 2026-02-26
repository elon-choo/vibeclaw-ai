import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  mode?: string;
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const result = await api.chat(userMsg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.text,
        model: result.model,
        mode: result.mode,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${(e as Error).message}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '20vh', color: '#444' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
            <h2 style={{ fontSize: 24, color: '#666', marginBottom: 8 }}>Vibepity</h2>
            <p style={{ color: '#555' }}>무엇이든 물어보세요. ChatGPT와 동일한 AI입니다.</p>
            <p style={{ color: '#444', fontSize: 13, marginTop: 8 }}>Tip: /code, /creative, /search 로 모드 전환</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 16,
          }}>
            <div style={{
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.role === 'user' ? '#8b5cf6' : '#1a1a1a',
              color: msg.role === 'user' ? 'white' : '#e5e5e5',
              fontSize: 14,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.content}
              {msg.model && (
                <div style={{ fontSize: 11, color: msg.role === 'user' ? 'rgba(255,255,255,0.5)' : '#555', marginTop: 6 }}>
                  {msg.model} | {msg.mode}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 4, padding: '8px 0' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6',
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid #2a2a2a',
        background: '#111',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요... (Shift+Enter 줄바꿈)"
            rows={1}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 12,
              color: '#e5e5e5',
              resize: 'none',
              outline: 'none',
              fontSize: 14,
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="btn btn-primary"
            style={{
              padding: '12px 24px',
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
