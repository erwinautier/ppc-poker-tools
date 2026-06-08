import { useRef, useState } from 'react';
import type { HandActions } from '../engine/types';
import type { SizingRules } from '../engine/sizing';
import { exportData, parseImport } from '../engine/storage';

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div>
        <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>{title}</h3>
        {subtitle && <p style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Btn({
  onClick,
  color = 'neutral',
  children,
  disabled,
}: {
  onClick:  () => void;
  color?:   'green' | 'red' | 'neutral';
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const bg = color === 'green' ? '#16a34a' : color === 'red' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.07)';
  const border = color === 'red' ? '1px solid rgba(239,68,68,0.3)' : `1px solid rgba(255,255,255,${color === 'green' ? '0' : '0.12'})`;
  const textColor = color === 'red' ? '#ef4444' : '#fff';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background:   disabled ? 'rgba(255,255,255,0.04)' : bg,
        color:        disabled ? '#475569' : textColor,
        border,
        borderRadius: 8,
        padding:      '8px 16px',
        fontSize:     13,
        fontWeight:   600,
        cursor:       disabled ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ── Message ────────────────────────────────────────────────────────────────────

function Msg({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{
        background: ok ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
        border:     `1px solid ${ok ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)'}`,
        color:      ok ? '#22c55e' : '#f87171',
        fontSize:   12,
      }}
    >
      {text}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  ranges:         Record<string, HandActions>;
  sizing:         SizingRules;
  onImport:       (ranges: Record<string, HandActions>, sizing: SizingRules, mode: 'merge' | 'replace') => void;
  onResetRanges:  () => void;
  onResetSizing:  () => void;
}

export default function ImportExportPage({ ranges, sizing, onImport, onResetRanges, onResetSizing }: Props) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  const contextCount = Object.keys(ranges).length;
  const sizingCount  = Object.keys(sizing).length;
  const hasData      = contextCount > 0 || sizingCount > 0;

  // ── Export ────────────────────────────────────────────────────────────────────

  function handleExport() {
    const json  = exportData(ranges, sizing);
    const blob  = new Blob([json], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `poker-trainer-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const parts: string[] = [];
    if (contextCount > 0) parts.push(`${contextCount} contexte(s) préflop`);
    if (sizingCount  > 0) parts.push(`${sizingCount} règle(s) sizing`);
    setMsg({ ok: true, text: `Export réussi — ${parts.join(', ')}.` });
  }

  // ── Import ────────────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);

    const reader = new FileReader();
    reader.onload = ev => {
      const raw = ev.target?.result;
      if (typeof raw !== 'string') {
        setMsg({ ok: false, text: 'Impossible de lire le fichier.' });
        return;
      }
      const result = parseImport(raw);
      if (!result.ok || !result.ranges) {
        setMsg({ ok: false, text: result.error ?? 'Fichier invalide.' });
        return;
      }
      onImport(result.ranges, result.sizing ?? {}, importMode);

      const parts: string[] = [];
      if ((result.contextCount ?? 0) > 0) parts.push(`${result.contextCount} contexte(s) préflop`);
      const sz = Object.keys(result.sizing ?? {}).length;
      if (sz > 0) parts.push(`${sz} règle(s) sizing`);

      setMsg({
        ok: true,
        text: `Import réussi — ${parts.join(', ')} ${importMode === 'merge' ? 'fusionné(s)' : 'remplacé(s)'}.`,
      });
    };
    reader.readAsText(file);

    // Reset input so same file can be re-imported
    e.target.value = '';
  }

  // ── Reset ─────────────────────────────────────────────────────────────────────

  function handleResetRanges() {
    if (!confirm('Supprimer toutes les ranges ? Cette action est irréversible.')) return;
    onResetRanges();
    setMsg({ ok: true, text: 'Toutes les ranges ont été supprimées.' });
  }

  function handleResetSizing() {
    if (!confirm('Supprimer toutes les règles de sizing ? Cette action est irréversible.')) return;
    onResetSizing();
    setMsg({ ok: true, text: 'Toutes les règles de sizing ont été supprimées.' });
  }

  return (
    <div className="space-y-4">
      {/* Export */}
      <Section
        title="Exporter les données"
        subtitle="Télécharger ranges et sizing au format JSON"
      >
        <div style={{ color: '#94a3b8', fontSize: 12 }} className="space-y-1">
          {contextCount > 0
            ? <div>📋 {contextCount} contexte(s) préflop</div>
            : <div style={{ color: '#475569' }}>Aucune range définie.</div>}
          {sizingCount > 0
            ? <div>📐 {sizingCount} règle(s) de sizing</div>
            : <div style={{ color: '#475569' }}>Aucune règle de sizing définie.</div>}
        </div>
        <Btn onClick={handleExport} color="green" disabled={!hasData}>
          ↓ Télécharger le fichier JSON
        </Btn>
      </Section>

      {/* Import */}
      <Section
        title="Importer des données"
        subtitle="Restaurer un fichier JSON exporté précédemment"
      >
        {/* Import mode */}
        <div className="flex gap-2">
          {(['merge', 'replace'] as const).map(m => (
            <button
              key={m}
              onClick={() => setImportMode(m)}
              style={{
                background:   importMode === m ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                color:        importMode === m ? '#60a5fa' : '#64748b',
                border:       `1px solid ${importMode === m ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 6,
                padding:      '4px 12px',
                fontSize:     12,
                cursor:       'pointer',
              }}
            >
              {m === 'merge' ? 'Fusionner' : 'Remplacer tout'}
            </button>
          ))}
        </div>
        <p style={{ color: '#475569', fontSize: 11 }}>
          {importMode === 'merge'
            ? "Les données importées s'ajouteront aux existantes (les conflits seront écrasés)."
            : 'Toutes les données existantes seront remplacées par le fichier importé.'}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <Btn onClick={() => fileRef.current?.click()}>
          ↑ Choisir un fichier JSON…
        </Btn>
      </Section>

      {/* Feedback */}
      {msg && <Msg ok={msg.ok} text={msg.text} />}

      {/* Danger zone */}
      <Section title="Zone de danger">
        <p style={{ color: '#64748b', fontSize: 12 }}>
          Ces actions sont irréversibles. Exportez d'abord vos données.
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={handleResetRanges} color="red">
            Supprimer les ranges
          </Btn>
          <Btn onClick={handleResetSizing} color="red">
            Supprimer le sizing
          </Btn>
        </div>
      </Section>
    </div>
  );
}
