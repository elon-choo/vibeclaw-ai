import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Skill {
  name: string;
  title: string;
  description: string;
  security?: { level: string; riskScore: number };
}

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSkills = async () => {
    try {
      const data = await api.getSkills();
      setSkills(data);
    } catch (e) {
      console.error('Failed to fetch skills:', e);
    }
  };

  useEffect(() => { fetchSkills(); }, []);

  const handleScan = async () => {
    setLoading(true);
    try {
      await api.scanSkills();
      await fetchSkills();
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (name: string) => {
    if (!confirm(`Remove skill "${name}"?`)) return;
    await api.removeSkill(name);
    await fetchSkills();
  };

  const levelColor = (level?: string) => {
    switch (level) {
      case 'safe': case 'low': return '#4ade80';
      case 'medium': return '#facc15';
      case 'high': case 'critical': return '#f87171';
      default: return '#888';
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Skills</h2>
        <button className="btn btn-ghost" onClick={handleScan} disabled={loading}>
          {loading ? 'Scanning...' : '🔍 Scan All'}
        </button>
      </div>

      {skills.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
          <p style={{ color: '#888' }}>No skills installed</p>
          <p style={{ color: '#555', fontSize: 13, marginTop: 8 }}>
            Install from CLI: vibepity skill install &lt;name&gt;
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {skills.map(skill => (
            <div key={skill.name} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{skill.title}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{skill.description}</div>
                {skill.security && (
                  <div style={{ fontSize: 11, color: levelColor(skill.security.level), marginTop: 4 }}>
                    Security: {skill.security.level.toUpperCase()} ({skill.security.riskScore}/100)
                  </div>
                )}
              </div>
              <button className="btn btn-ghost" onClick={() => handleRemove(skill.name)} style={{ color: '#f87171', fontSize: 12 }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
