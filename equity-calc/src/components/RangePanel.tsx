import { useEffect, useMemo, useRef, useState } from 'react';
import { RANKS_DESC } from '../lib/cards';
import {
  cellToHand, combosCount, parseRange, serializeRange, topPercent,
  rangeCombos, rangeRankPercent, TOTAL_COMBOS,
} from '../lib/range';
import { loadSavedRanges, loadEditorRanges, saveRange, deleteRange, type SavedRange } from '../lib/storage';

interface Props {
  name: string;
  range: Set<string>;
  onChange: (r: Set<string>) => void;
  /** Hands that have zero live combos given dead cards (purely visual). */
  deadHands?: Set<string>;
}

export function RangePanel({ name, range, onChange, deadHands }: Props) {
  const [text, setText] = useState(() => serializeRange(range));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedRange[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const dragMode = useRef<'add' | 'remove' | null>(null);
  const lastSerialized = useRef(text);

  // Keep text in sync when the range changes from grid/slider/load
  useEffect(() => {
    const s = serializeRange(range);
    if (s !== lastSerialized.current) {
      lastSerialized.current = s;
      setText(s);
      setErrors([]);
    }
  }, [range]);

  useEffect(() => { setSaved([...loadSavedRanges(), ...loadEditorRanges()]); }, []);

  const combos = rangeCombos(range);
  const comboPct = (combos / TOTAL_COMBOS) * 100;
  const rankPct = useMemo(() => rangeRankPercent(range), [range]);

  function applyText(v: string) {
    setText(v);
    const { range: r, errors: e } = parseRange(v);
    setErrors(e);
    if (e.length === 0) { lastSerialized.current = serializeRange(r); onChange(r); }
  }

  function toggle(hand: string, mode: 'add' | 'remove') {
    const next = new Set(range);
    if (mode === 'add') next.add(hand); else next.delete(hand);
    onChange(next);
  }

  function onCellDown(hand: string) {
    const mode = range.has(hand) ? 'remove' : 'add';
    dragMode.current = mode;
    toggle(hand, mode);
  }
  function onCellEnter(hand: string) {
    if (!dragMode.current) return;
    if (dragMode.current === 'add' ? !range.has(hand) : range.has(hand)) toggle(hand, dragMode.current);
  }
  useEffect(() => {
    const up = () => { dragMode.current = null; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  function onTouchMove(e: React.TouchEvent) {
    if (!dragMode.current) return;
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
    const hand = el?.dataset?.hand;
    if (hand) onCellEnter(hand);
  }

  function doSave() {
    const n = prompt('Nom de la range :', name);
    if (!n) return;
    saveRange(n.trim(), serializeRange(range));
    setSaved([...loadSavedRanges(), ...loadEditorRanges()]);
  }
  function doDelete() {
    const r = saved.find(s => s.id === selectedId);
    if (!r || r.source !== 'local') return;
    if (!confirm(`Supprimer « ${r.name} » ?`)) return;
    deleteRange(r.id);
    setSaved([...loadSavedRanges(), ...loadEditorRanges()]);
    setSelectedId('');
  }
  function doLoad(id: string) {
    setSelectedId(id);
    const r = saved.find(s => s.id === id);
    if (!r) return;
    const { range: parsed } = parseRange(r.text);
    onChange(parsed);
  }

  const selected = saved.find(s => s.id === selectedId);

  return (
    <div className="card">
      <div className="panel-head">
        <h2>{name}</h2>
        <span className="stats">
          R : {rankPct.toFixed(1)}% · C : {comboPct.toFixed(1)}% ({combos} combos)
        </span>
      </div>

      <textarea
        className={`range-text${errors.length ? ' err' : ''}`}
        value={text}
        placeholder="AA, KK, AKs, T5o+, 96s-, 66-99…"
        onChange={e => applyText(e.target.value)}
        spellCheck={false}
      />
      {errors.length > 0 && <div className="err-msg">Non reconnu : {errors.join(', ')}</div>}

      <input
        type="range" min={0} max={100} step={0.5} className="slider"
        value={Math.round(rankPct * 2) / 2}
        onChange={e => { onChange(topPercent(Number(e.target.value))); }}
        title="Top X% des mains"
      />

      <div className="grid13" onTouchMove={onTouchMove}>
        {RANKS_DESC.map((_, row) =>
          RANKS_DESC.map((__, col) => {
            const hand = cellToHand(row, col);
            const on = range.has(hand);
            const cls = `cell${row === col ? ' pair' : ''}${on ? ' on' : ''}${deadHands?.has(hand) ? ' dead' : ''}`;
            return (
              <div
                key={hand}
                data-hand={hand}
                className={cls}
                title={`${hand} · ${combosCount(hand)} combos`}
                onPointerDown={e => { e.preventDefault(); onCellDown(hand); }}
                onPointerEnter={() => onCellEnter(hand)}
              >
                {hand}
              </div>
            );
          }),
        )}
      </div>

      <div className="panel-foot">
        <button className="btn sm" onClick={() => onChange(new Set())}>Vider</button>
        <button className="btn success sm" onClick={doSave}>Sauvegarder</button>
        <button className="btn danger sm" onClick={doDelete} disabled={!selected || selected.source !== 'local'}>Supprimer</button>
        <select value={selectedId} onChange={e => doLoad(e.target.value)}>
          <option value="">— Charger une range —</option>
          {saved.some(s => s.source === 'local') && (
            <optgroup label="Mes ranges (calculateur)">
              {saved.filter(s => s.source === 'local').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          )}
          {saved.some(s => s.source === 'editor') && (
            <optgroup label="Range Editor">
              {saved.filter(s => s.source === 'editor').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>
    </div>
  );
}
