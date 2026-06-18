import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Info, Upload, Cloud, CloudOff } from 'lucide-react';
import { getPlayableRanges } from '../lib/storage';
import { loadGroqKey, saveGroqKey, deleteGroqKeyFromCloud, isLoggedIn } from '../lib/supabase';
import type { Range, AppState } from '../types';

interface SetupPageProps {
  onStart: (params: {
    apiKey: string;
    ranges: Range[];
  }) => void;
}

function cleanHands(hands: Record<string, Record<string, number>>): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [hand, assignment] of Object.entries(hands)) {
    const sum = Object.values(assignment).reduce((s, v) => s + v, 0);
    if (sum > 0) result[hand] = assignment;
  }
  return result;
}

export default function SetupPage({ onStart }: SetupPageProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [ranges, setRanges] = useState<Range[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);
  const [saveToCloud, setSaveToCloud] = useState(false);
  const [keyFromCloud, setKeyFromCloud] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loaded = getPlayableRanges();
    applyRanges(loaded);
    // Load saved API key + check login state
    isLoggedIn().then(setLoggedIn);
    loadGroqKey().then(result => {
      if (result) {
        setApiKey(result.key);
        if (result.source === 'supabase') {
          setKeyFromCloud(true);
          setSaveToCloud(true);
        }
      }
    });
  }, []);

  function applyRanges(loaded: Range[]) {
    setRanges(loaded);
    setSelectedIds(new Set(loaded.map(r => r.id)));
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed: AppState = JSON.parse(ev.target!.result as string);
        if (!Array.isArray(parsed.ranges)) throw new Error('Format invalide');
        const cleaned = parsed.ranges
          .map(r => ({ ...r, hands: cleanHands(r.hands ?? {}) }))
          .filter(r => Object.keys(r.hands).length > 0);
        if (cleaned.length === 0) throw new Error('Aucune range jouable dans ce fichier');
        applyRanges(cleaned);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Fichier invalide');
      }
    };
    reader.readAsText(file);
    // reset input so same file can be re-imported
    e.target.value = '';
  }

  const selectedRanges = ranges.filter(r => selectedIds.has(r.id));
  const canStart = apiKey.trim().length > 10 && selectedRanges.length >= 2;

  function toggleRange(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDeleteFromCloud() {
    setCloudSaving(true);
    try {
      await deleteGroqKeyFromCloud();
      setKeyFromCloud(false);
      setSaveToCloud(false);
    } finally {
      setCloudSaving(false);
    }
  }

  async function handleStart() {
    if (!canStart) return;
    const key = apiKey.trim();
    setCloudSaving(true);
    try {
      await saveGroqKey(key, saveToCloud && loggedIn);
    } finally {
      setCloudSaving(false);
    }
    onStart({ apiKey: key, ranges: selectedRanges });
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🃏</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Postflop Trainer
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 6 }}>
            SRP · HU · 6-max · Commentaires par Llama IA (Groq)
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* API Key */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                Clé API Groq (gratuit)
              </label>
              <button
                onClick={() => setShowTip(t => !t)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                title="Comment obtenir une clé API"
              >
                <Info size={15} />
              </button>
            </div>

            {showTip && (
              <div style={{
                background: '#0f2234', border: '1px solid #1e3a5f', borderRadius: 8,
                padding: '10px 12px', marginBottom: 10, fontSize: '0.78rem', color: '#93c5fd', lineHeight: 1.6,
              }}>
                <strong>Comment obtenir une clé Groq gratuite :</strong><br />
                1. Va sur <strong>console.groq.com</strong><br />
                2. Crée un compte (Google ou email)<br />
                3. Dans "API Keys" → "Create API Key"<br />
                4. Colle-la ici — gratuit, pas de CB requise
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="gsk_..."
                style={{
                  width: '100%', padding: '10px 44px 10px 12px', boxSizing: 'border-box',
                  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--text)', fontSize: '0.85rem', outline: 'none',
                }}
              />
              <button
                onClick={() => setShowKey(s => !s)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                }}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {/* Save-to-cloud checkbox */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: loggedIn ? 'pointer' : 'default',
            }}>
              <input
                type="checkbox"
                checked={saveToCloud}
                onChange={e => setSaveToCloud(e.target.checked)}
                disabled={!loggedIn}
                style={{ accentColor: '#3b82f6', width: 15, height: 15, cursor: loggedIn ? 'pointer' : 'not-allowed' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: loggedIn ? 'var(--text)' : 'var(--text-muted)' }}>
                {saveToCloud ? <Cloud size={13} /> : <CloudOff size={13} />}
                Mémoriser sur tous mes appareils
                {!loggedIn && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>(connexion requise via Poker Trainer)</span>}
              </span>
            </label>

            {/* Delete from cloud button */}
            {keyFromCloud && (
              <button
                onClick={handleDeleteFromCloud}
                disabled={cloudSaving}
                style={{
                  marginTop: 8, padding: '6px 12px', background: 'none',
                  border: '1px solid #7f1d1d', borderRadius: 8,
                  color: '#f87171', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <CloudOff size={12} />
                {cloudSaving ? 'Suppression…' : 'Effacer la clé de la base de données'}
              </button>
            )}
          </div>

          {/* Range selection */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Ranges
              </h2>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', background: 'var(--surface2)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                title="Importer un fichier JSON de ranges"
              >
                <Upload size={13} /> Importer JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </div>

            {importError && (
              <div style={{
                background: '#2d0f0f', border: '1px solid #7f1d1d', borderRadius: 8,
                padding: '8px 12px', marginBottom: 12, fontSize: '0.78rem', color: '#fca5a5',
              }}>
                ⚠️ {importError}
              </div>
            )}

            {ranges.length === 0 ? (
              <div style={{
                background: '#1a1200', border: '1px solid #78350f', borderRadius: 8,
                padding: '12px 14px', fontSize: '0.82rem', color: '#fde68a', lineHeight: 1.6,
              }}>
                Aucune range chargée.<br />
                <span style={{ color: '#c8b068' }}>
                  Importez un fichier JSON via le bouton ci-dessus, ou utilisez le Range Editor sur le même domaine.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>
                  Cochez les positions à inclure dans le tirage aléatoire (min. 2) :
                </p>
                {ranges.map(r => (
                  <label key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    padding: '8px 10px', borderRadius: 8,
                    background: selectedIds.has(r.id) ? '#0a1f3a' : 'var(--surface2)',
                    border: `1px solid ${selectedIds.has(r.id) ? '#1d4ed8' : 'var(--border)'}`,
                    transition: 'background 0.1s, border-color 0.1s',
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleRange(r.id)}
                      style={{ accentColor: '#3b82f6', width: 15, height: 15 }}
                    />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600, minWidth: 36 }}>
                      {r.position}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {r.title} · {Object.keys(r.hands).length} mains · {r.stackBB}bb
                    </span>
                  </label>
                ))}
                {selectedRanges.length >= 2 && (
                  <div style={{ fontSize: '0.75rem', color: '#86efac', background: '#0a2010', borderRadius: 8, padding: '7px 10px', marginTop: 2 }}>
                    ✓ {selectedRanges.length} positions sélectionnées — hero et villain tirés aléatoirement à chaque main
                  </div>
                )}
                {selectedRanges.length < 2 && ranges.length > 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#f87171', margin: 0 }}>
                    ⚠️ Sélectionnez au moins 2 positions.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Start button */}
          <button
            onClick={() => { void handleStart(); }}
            disabled={!canStart || cloudSaving}
            style={{
              padding: '14px 20px',
              background: canStart ? '#1d4ed8' : '#1e2433',
              border: `1px solid ${canStart ? '#3b82f6' : 'var(--border)'}`,
              borderRadius: 12,
              color: canStart ? '#fff' : 'var(--text-muted)',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: canStart ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (canStart) e.currentTarget.style.background = '#1e40af'; }}
            onMouseLeave={e => { if (canStart) e.currentTarget.style.background = '#1d4ed8'; }}
          >
            Démarrer une main →
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 20 }}>
          <a href="/editor/" style={{ color: 'var(--text-muted)' }}>← Range Editor</a>
          &nbsp;·&nbsp;
          <a href="/" style={{ color: 'var(--text-muted)' }}>Accueil</a>
        </p>
      </div>
    </div>
  );
}
