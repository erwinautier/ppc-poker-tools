import { useState, useEffect } from 'react';
import './App.css';
import ReTrainerPage from './pages/ReTrainerPage';
import StatsPage     from './pages/StatsPage';
import DataPage      from './pages/DataPage';

// ── Font size ─────────────────────────────────────────────────────────────────

type FontSize = 'sm' | 'md' | 'lg';
const FONT_PX: Record<FontSize, string> = { sm: '12px', md: '14px', lg: '16px' };

function loadFontSize(): FontSize {
  return (localStorage.getItem('trainer-font') as FontSize) ?? 'md';
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'train' | 'stats' | 'data';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'train', icon: '🎯', label: 'Entraînement' },
  { id: 'stats', icon: '📊', label: 'Stats'        },
  { id: 'data',  icon: '↕️', label: 'Données'      },
];

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]         = useState<Tab>('train');
  const [fontSize, setFontSize] = useState<FontSize>(loadFontSize);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-size', FONT_PX[fontSize]);
    localStorage.setItem('trainer-font', fontSize);
  }, [fontSize]);

  function cycleFontSize() {
    setFontSize(f => f === 'sm' ? 'md' : f === 'md' ? 'lg' : 'sm');
  }

  const fontSizePx = { sm: 11, md: 14, lg: 17 }[fontSize];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        height: 'var(--header-h)',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12,
        position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
      }}>
        <a href="/" title="Accueil" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', flex: 1 }}>
          <img src={`${import.meta.env.BASE_URL}logo-ppc.jpg`} alt="PPC" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>Poker Trainer</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>NLHE · Pré-flop</div>
          </div>
        </a>

        {/* Font size toggle */}
        <button
          onClick={cycleFontSize}
          title={`Taille du texte (actuel : ${fontSize})`}
          style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            display: 'flex', alignItems: 'baseline', gap: 1,
          }}
        >
          <span style={{ fontSize: fontSizePx, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>A</span>
          <span style={{ fontSize: 8, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
            {fontSize === 'sm' ? '↑' : fontSize === 'md' ? '↕' : '↓'}
          </span>
        </button>
      </header>

      {/* ── Content ── */}
      <main style={{
        flex: 1, overflowY: 'auto',
        padding: '20px 16px calc(var(--nav-h) + 20px)',
        maxWidth: 640, width: '100%', margin: '0 auto',
      }}>
        {tab === 'train' && <ReTrainerPage />}
        {tab === 'stats' && <StatsPage />}
        {tab === 'data'  && <DataPage />}
      </main>

      {/* ── Bottom nav ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 'var(--nav-h)',
        background: 'rgba(26,31,46,0.97)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border)',
        display: 'flex', zIndex: 100,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '0.625rem', fontWeight: tab === t.id ? 700 : 500,
              padding: '6px 0', transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
