import { useState, useEffect, useSyncExternalStore } from 'react';
import { getDA, logoFile, subscribeDA, toggleDA } from '../../shared/ppc-da.js';
import './App.css';
import ReTrainerPage from './pages/ReTrainerPage';
import StatsPage     from './pages/StatsPage';
import DataPage      from './pages/DataPage';
import { AuthGate, useAuthContext } from './lib/AuthGate';
import { useAuth } from './lib/useAuth';
import { useCloudSync } from './lib/useCloudSync';
import { SyncProvider } from './lib/SyncContext';
import { LogOut } from 'lucide-react';

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

// ── Save indicator ─────────────────────────────────────────────────────────────

function SyncBadge({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;
  const map = {
    saving: { label: 'Sauvegarde…', color: 'var(--text-muted)' },
    saved:  { label: '✓ Sauvegardé', color: 'var(--success)' },
    error:  { label: '⚠ Erreur sync', color: 'var(--danger)' },
  } as const;
  const { label, color } = map[status];
  return <span style={{ fontSize: '0.7rem', color }}>{label}</span>;
}

// ── Inner App ─────────────────────────────────────────────────────────────────

function AppInner() {
  const da = useSyncExternalStore(subscribeDA, getDA);
  const { username, signOut } = useAuthContext();
  const { state: authState } = useAuth();
  const userId = authState.status === 'authenticated' ? authState.user.id : null;
  const { status: syncStatus, scheduleSync } = useCloudSync(userId);

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
    <SyncProvider scheduleSync={scheduleSync}>
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header style={{
        height: 'var(--header-h)',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'inset 0 3px 0 var(--signature)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12,
        position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
      }}>
        <a href="/" title="Accueil" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', flex: 1 }}>
          <img src={`${import.meta.env.BASE_URL}${logoFile(da)}`} alt="PPC" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          <div>
            <div className="ppc-title" style={{ fontSize: '1.05rem', color: 'var(--ppc-ivoire)', lineHeight: 1.1 }}>Poker Trainer</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>NLHE · Pré-flop</div>
          </div>
        </a>

        {/* Sync badge */}
        <SyncBadge status={syncStatus} />

        <button type="button" className="ppc-da-switch" onClick={toggleDA} title="Changer de direction artistique" aria-label="Changer de direction artistique" />

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

        {/* User / logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{username}</span>
          <button
            title="Se déconnecter" onClick={signOut}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{
        flex: 1, overflowY: 'auto',
        padding: '20px 16px calc(var(--nav-h) + 20px)',
        maxWidth: 640, width: '100%', margin: '0 auto',
      }}>
        {tab === 'train' && <ReTrainerPage />}
        {tab === 'stats' && <StatsPage />}
        {tab === 'data'  && <DataPage username={username} />}
      </main>

      {/* ── Bottom nav ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 'var(--nav-h)',
        background: 'color-mix(in srgb, var(--surface) 96%, transparent)',
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
    </SyncProvider>
  );
}

export default function App() {
  return (
    <AuthGate>
      <AppInner />
    </AuthGate>
  );
}
