import { useState, useCallback, useEffect } from 'react';
import type { AppState, Range } from './types';
import { loadState, saveState, exportStateJSON, importStateJSON, newRange } from './store';
import { exportRangeToPDF } from './pdfExport';
import Sidebar from './components/Sidebar';
import HandMatrix from './components/HandMatrix';
import PaletteEditor from './components/PaletteEditor';
import RangeSettings from './components/RangeSettings';
import RangeStats from './components/RangeStats';
import { Download, FileDown, Upload, Eraser, Menu, X } from 'lucide-react';
import './App.css';

type MatrixFont = 'sm' | 'md' | 'lg';

function loadFont(): MatrixFont {
  return (localStorage.getItem('matrix-font') as MatrixFont) ?? 'md';
}

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [selectedRangeId, setSelectedRangeId] = useState<string | null>(
    () => loadState().ranges[0]?.id ?? null
  );
  const [activeColorId, setActiveColorId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState(100);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [matrixFont, setMatrixFont] = useState<MatrixFont>(loadFont);

  useEffect(() => { saveState(state); }, [state]);

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
    setSidebarOpen(false); // ferme le sidebar sur mobile après sélection
    const r = state.ranges.find(r => r.id === id);
    if (r && r.palette.length > 0) {
      setActiveColorId(r.palette[0].id);
    }
  };

  const clearRange = () => {
    if (!selectedRange) return;
    if (confirm('Effacer toutes les mains de cette range ?')) {
      updateRange({ hands: {} });
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const imported = await importStateJSON(file);
        setState(imported);
        setSelectedRangeId(imported.ranges[0]?.id ?? null);
      } catch {
        alert("Erreur lors de l'import du fichier JSON.");
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
        {/* Sélecteur de taille de police */}
        <div className="font-size-selector" title="Taille du texte dans la matrice">
          {(['sm', 'md', 'lg'] as MatrixFont[]).map((f, i) => (
            <button
              key={f}
              className={`font-size-btn ${matrixFont === f ? 'active' : ''}`}
              onClick={() => handleFontChange(f)}
              title={f === 'sm' ? 'Petit' : f === 'md' ? 'Moyen' : 'Grand'}
              style={{ fontSize: `${11 + i * 3}px` }}
            >
              A
            </button>
          ))}
        </div>

        <div className="header-actions">
          <button className="btn" onClick={handleImport}>
            <Upload size={15} /><span className="btn-label"> Importer</span>
          </button>
          <button className="btn" onClick={() => exportStateJSON(state)}>
            <Download size={15} /><span className="btn-label"> JSON</span>
          </button>
          {selectedRange && (
            <button className="btn accent" onClick={() => exportRangeToPDF(selectedRange, matrixFont).catch(console.error)}>
              <FileDown size={15} /><span className="btn-label"> PDF</span>
            </button>
          )}
        </div>
      </header>

      {/* Overlay mobile pour fermer le sidebar */}
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

                {/* Zone de notes */}
                <div className="notes-wrapper">
                  <label className="notes-label">
                    Remarques
                    <span className="notes-count">
                      {(selectedRange.notes ?? '').length}/500
                    </span>
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
