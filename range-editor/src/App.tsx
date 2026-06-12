import { useState, useCallback, useEffect } from 'react';
import type { AppState, Range } from './types';
import { loadState, saveState, exportStateJSON, importAndMergeStateJSON, newRange } from './store';
import { exportRangeToPDF } from './pdfExport';
import Sidebar from './components/Sidebar';
import HandMatrix from './components/HandMatrix';
import PaletteEditor from './components/PaletteEditor';
import RangeSettings from './components/RangeSettings';
import RangeStats from './components/RangeStats';
import { Download, FileDown, Upload, Eraser, Menu, X, LogOut, MoreVertical } from 'lucide-react';
import { AuthGate, useAuthContext } from './lib/AuthGate';
import { useCloudSync } from './lib/useCloudSync';
import { useAuth } from './lib/useAuth';
import './App.css';

type MatrixFont = 'sm' | 'md' | 'lg';

function loadFont(): MatrixFont {
  return (localStorage.getItem('matrix-font') as MatrixFont) ?? 'md';
}

// ── Save indicator ────────────────────────────────────────────────────────────
function SyncBadge({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;
  const map = {
    saving: { label: 'Sauvegarde…', color: '#7a8299' },
    saved:  { label: '✓ Sauvegardé', color: '#4ade80' },
    error:  { label: '⚠ Erreur sync', color: '#f87171' },
  } as const;
  const { label, color } = map[status];
  return (
    <span style={{ fontSize: '0.75rem', color, transition: 'color 0.3s' }}>{label}</span>
  );
}

// ── Inner app (requires auth context) ────────────────────────────────────────
function AppInner() {
  const { username, signOut } = useAuthContext();
  const { state: authState } = useAuth();
  const userId = authState.status === 'authenticated' ? authState.user.id : null;
  const { scheduleSync, status: syncStatus, loaded } = useCloudSync(userId);
  const [moreOpen, setMoreOpen] = useState(false);

  const [state, setState] = useState<AppState>(loadState);
  const [selectedRangeId, setSelectedRangeId] = useState<string | null>(
    () => loadState().ranges[0]?.id ?? null
  );
  const [activeColorId, setActiveColorId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState(100);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [matrixFont, setMatrixFont] = useState<MatrixFont>(loadFont);

  // Re-read state from localStorage once cloud data has loaded
  useEffect(() => {
    if (!loaded) return;
    const fresh = loadState();
    setState(fresh);
    setSelectedRangeId(fresh.ranges[0]?.id ?? null);
  }, [loaded]);

  // Save to localStorage + schedule cloud sync on every state change
  useEffect(() => {
    if (!loaded) return;
    saveState(state);
    scheduleSync();
  }, [state, loaded, scheduleSync]);

  const handleFontChange = (f: MatrixFont) => {
    setMatrixFont(f);
    localStorage.setItem('matrix-font', f);
  };

  const selectedRange = state.ranges.find(r => r.id === selectedRangeId) ?? null;

  const updateRange = useCallback((updates: Partial<Range>) => {
    if (!selectedRangeId) return;
    setState(prev => ({
      ...prev,
      ranges: prev.ranges.map(r =>
        r.id === selectedRangeId ? { ...r, ...updates, updatedAt: Date.now() } : r
      ),
    }));
  }, [selectedRangeId]);

  const handleSelectRange = (id: string) => {
    setSelectedRangeId(id);
    setSidebarOpen(false);
    const r = state.ranges.find(r => r.id === id);
    if (r && r.palette.length > 0) setActiveColorId(r.palette[0].id);
  };

  const clearRange = () => {
    if (!selectedRange) return;
    if (confirm('Effacer toutes les mains de cette range ?')) updateRange({ hands: {} });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const merged = await importAndMergeStateJSON(file, state);
        setState(merged);
        setSelectedRangeId(merged.ranges[0]?.id ?? null);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erreur lors de l'import du fichier JSON.");
      }
    };
    input.click();
  };

  const handlePaletteChange = (palette: Range['palette']) => {
    updateRange({ palette });
    if (!palette.find(p => p.id === activeColorId) && palette.length > 0) {
      setActiveColorId(palette[0].id);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <button className="btn-hamburger" onClick={() => setSidebarOpen(o => !o)}>
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="app-logo">
          <a href="/" title="Accueil" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
            <img src={`${import.meta.env.BASE_URL}logo-ppc.jpg`} alt="PPC" className="header-logo" />
            <span className="header-title">Range Editor</span>
          </a>
        </div>

        {/* Font size selector */}
        <div className="font-size-selector" title="Taille du texte dans la matrice">
          {(['sm', 'md', 'lg'] as MatrixFont[]).map((f, i) => (
            <button
              key={f}
              className={`font-size-btn ${matrixFont === f ? 'active' : ''}`}
              onClick={() => handleFontChange(f)}
              title={f === 'sm' ? 'Petit' : f === 'md' ? 'Moyen' : 'Grand'}
              style={{ fontSize: `${11 + i * 3}px` }}
            >A</button>
          ))}
        </div>

        {/* Sync badge */}
        <SyncBadge status={syncStatus} />

        <div className="header-actions">
          {/* Desktop : boutons visibles */}
          <button className="btn desktop-only" onClick={handleImport}>
            <Upload size={15} /><span className="btn-label"> Importer</span>
          </button>
          <button className="btn desktop-only" onClick={() => exportStateJSON(state, username)}>
            <Download size={15} /><span className="btn-label"> JSON</span>
          </button>
          {selectedRange && (
            <button className="btn accent desktop-only" onClick={() => exportRangeToPDF(selectedRange, matrixFont).catch(console.error)}>
              <FileDown size={15} /><span className="btn-label"> PDF</span>
            </button>
          )}

          {/* Mobile : menu ··· */}
          <div className="mobile-only" style={{ position: 'relative' }}>
            <button className="btn" onClick={() => setMoreOpen(o => !o)} title="Plus d'actions">
              <MoreVertical size={16} />
            </button>
            {moreOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                  onClick={() => setMoreOpen(false)}
                />
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, overflow: 'hidden', minWidth: 180,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  {[
                    { icon: <Upload size={15} />, label: 'Importer', action: () => { handleImport(); setMoreOpen(false); } },
                    { icon: <Download size={15} />, label: 'Exporter JSON', action: () => { exportStateJSON(state, username); setMoreOpen(false); } },
                    ...(selectedRange ? [{ icon: <FileDown size={15} />, label: 'Exporter PDF', action: () => { exportRangeToPDF(selectedRange, matrixFont).catch(console.error); setMoreOpen(false); } }] : []),
                    { icon: <LogOut size={15} />, label: 'Déconnexion', action: () => { signOut(); setMoreOpen(false); } },
                  ].map(({ icon, label, action }) => (
                    <button key={label} onClick={action} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 16px', background: 'none', border: 'none',
                      color: 'var(--text)', cursor: 'pointer', fontSize: '0.9rem',
                      borderBottom: '1px solid var(--border)',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* User / logout — desktop only */}
          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{username}</span>
            <button className="btn" title="Se déconnecter" onClick={signOut}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="app-body">
        <Sidebar
          state={state}
          selectedRangeId={selectedRangeId}
          onSelectRange={handleSelectRange}
          onStateChange={setState}
          isOpen={sidebarOpen}
        />

        {selectedRange ? (
          <main className="main-content">
            <RangeSettings range={selectedRange} onChange={updateRange} />
            <div className="editor-area">
              <div className="matrix-wrapper">
                <HandMatrix
                  hands={selectedRange.hands}
                  palette={selectedRange.palette}
                  activeColorId={activeColorId}
                  frequency={frequency}
                  onHandsChange={hands => updateRange({ hands })}
                  fontSizeClass={matrixFont}
                />
                <button className="btn-clear" onClick={clearRange}>
                  <Eraser size={14} /> Tout effacer
                </button>
                <div className="notes-wrapper">
                  <label className="notes-label">
                    Remarques
                    <span className="notes-count">{(selectedRange.notes ?? '').length}/500</span>
                  </label>
                  <textarea
                    className="notes-textarea"
                    value={selectedRange.notes ?? ''}
                    maxLength={500}
                    rows={3}
                    placeholder="Notes, conseils, exceptions… (500 caractères max)"
                    onChange={e => updateRange({ notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="right-panel">
                <PaletteEditor
                  palette={selectedRange.palette}
                  activeColorId={activeColorId}
                  frequency={frequency}
                  onPaletteChange={handlePaletteChange}
                  onActiveColorChange={setActiveColorId}
                  onFrequencyChange={setFrequency}
                />
                <RangeStats range={selectedRange} />
              </div>
            </div>
          </main>
        ) : (
          <main className="main-content centered">
            <div className="welcome">
              <h2>Range Editor</h2>
              <p>Créez ou sélectionnez une range dans le panneau de gauche.</p>
              <button className="btn accent large" onClick={() => {
                const r = newRange();
                setState(prev => ({ ...prev, ranges: [...prev.ranges, r] }));
                handleSelectRange(r.id);
              }}>
                Créer ma première range
              </button>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <AppInner />
    </AuthGate>
  );
}
