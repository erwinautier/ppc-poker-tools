import { useState, useRef } from 'react';
import { loadREStats, saveREStats, type REStats } from '../engine/reStats';
import { importREStateFromJSON, type REState } from '../engine/rangeEditorBridge';

const RE_STORAGE_KEY = 'range-editor-v1';

export default function DataPage({ username }: { username?: string }) {
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRefRE   = useRef<HTMLInputElement>(null);
  const fileRefStats = useRef<HTMLInputElement>(null);

  function notify(text: string, ok = true) {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 3000);
  }

  // ── Import ranges from Range Editor ──────────────────────────────────────────

  async function handleImportRE(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const state: REState = await importREStateFromJSON(file);
      localStorage.setItem(RE_STORAGE_KEY, JSON.stringify(state));
      notify(`Import réussi — ${state.ranges.length} ranges, ${state.collections.length} collections.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur inconnue', false);
    }
    e.target.value = '';
  }

  // ── Export / Import trainer stats ─────────────────────────────────────────────

  function handleExportStats() {
    const stats = loadREStats();
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = username ? `${username}-stats-${date}.json` : `trainer-stats-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportStats(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: REStats = JSON.parse(text);
      if (!parsed.data) throw new Error('Format invalide');
      saveREStats(parsed);
      notify('Statistiques importées avec succès.');
    } catch {
      notify('Fichier de statistiques invalide.', false);
    }
    e.target.value = '';
  }

  // ── Reset stats ───────────────────────────────────────────────────────────────

  function handleResetStats() {
    if (!confirm('Supprimer toutes les statistiques d\'entraînement ? Cette action est irréversible.')) return;
    saveREStats({ data: {}, totalAttempts: 0, totalCorrect: 0 });
    notify('Statistiques réinitialisées.');
  }

  function handleClearRanges() {
    if (!confirm('Supprimer les ranges importées du Range Editor ? (Vos statistiques ne seront pas affectées.)')) return;
    localStorage.removeItem(RE_STORAGE_KEY);
    notify('Ranges supprimées du navigateur.');
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Message toast */}
      {message && (
        <div style={{
          background: message.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${message.ok ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
          borderRadius: 8, padding: '10px 14px',
          color: message.ok ? '#22c55e' : '#f87171',
          fontSize: '0.8rem', fontWeight: 600,
        }}>
          {message.text}
        </div>
      )}

      {/* Ranges */}
      <div>
        <p className="section-label">Ranges (Range Editor)</p>
        <div className="panel space-y-3">
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Importez un fichier JSON exporté depuis le Range Editor. Cela remplace les ranges actuellement chargées dans ce navigateur.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => fileRefRE.current?.click()}>
              Importer JSON (Range Editor)
            </button>
            <button className="btn btn-danger" onClick={handleClearRanges}>
              Supprimer les ranges
            </button>
          </div>
          <input ref={fileRefRE} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportRE} />
        </div>
      </div>

      {/* Stats */}
      <div>
        <p className="section-label">Statistiques d'entraînement</p>
        <div className="panel space-y-3">
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Exportez ou importez vos statistiques pour les sauvegarder entre appareils ou sessions.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={handleExportStats}>
              Exporter les stats
            </button>
            <button className="btn" onClick={() => fileRefStats.current?.click()}>
              Importer les stats
            </button>
            <button className="btn btn-danger" onClick={handleResetStats}>
              Réinitialiser les stats
            </button>
          </div>
          <input ref={fileRefStats} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportStats} />
        </div>
      </div>

    </div>
  );
}
