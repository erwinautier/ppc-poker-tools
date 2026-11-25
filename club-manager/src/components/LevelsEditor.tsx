import { useState } from 'react';
import { chipsTotal, DEFAULT_CHIPS, estimateMinutes, generateLevels, PRESETS, totalMinutes, type GeneratorInput } from '../lib/structure';
import * as f from '../lib/format';
import type { Chip, Level } from '../lib/types';
import { Choice, Field, Icon, Modal, NumberInput } from './ui';

export function LevelsEditor({ levels, onChange, players, stack }: { levels: Level[]; onChange: (l: Level[]) => void; players: number; stack: number }) {
  const [generating, setGenerating] = useState(false);
  const set = (i: number, patch: Partial<Level>) => onChange(levels.map((l, j) => j === i ? { ...l, ...patch } : l));
  const insert = (i: number, l: Level) => onChange([...levels.slice(0, i), l, ...levels.slice(i)]);
  const swap = (i: number, j: number) => { const c = [...levels]; [c[i], c[j]] = [c[j], c[i]]; onChange(c); };
  const lastLevel = [...levels].reverse().find(l => l.kind === 'level');
  const nextLevel = (): Level => lastLevel
    ? { kind: 'level', sb: lastLevel.sb * 2, bb: lastLevel.bb * 2, ante: lastLevel.ante * 2, minutes: lastLevel.minutes }
    : { kind: 'level', sb: 50, bb: 100, ante: 0, minutes: 15 };
  const est = estimateMinutes(levels, players, stack);
  let n = 0;

  return (
    <div className="stack">
      <div className="row between">
        <span className="muted">
          {levels.length === 0 ? 'Aucun niveau.' : <>{f.plural(levels.filter(l => l.kind === 'level').length, 'niveau', 'niveaux')}, {f.duration(totalMinutes(levels))} au total.
            {' '}{est ? `Fin probable après ${f.duration(est)} à ${players} joueurs.` : `Trop lente pour finir à ${players} joueurs.`}</>}
        </span>
        <button type="button" className="btn sm" onClick={() => setGenerating(true)}><Icon name="dice" size={15} />Générer</button>
      </div>
      {levels.length > 0 && (
        <div className="levels">
          <div className="lrow head"><span /><span>Petite</span><span>Grosse</span><span>Ante</span><span>Minutes</span><span /></div>
          {levels.map((l, i) => {
            if (l.kind === 'level') n++;
            return (
              <div className={`lrow ${l.kind === 'break' ? 'is-break' : ''}`} key={i}>
                <span className="no">{l.kind === 'level' ? n : <Icon name="pause" size={16} />}</span>
                {l.kind === 'break'
                  ? <input className="blabel" value={l.label ?? ''} placeholder="Pause" aria-label="Nom de la pause" onChange={e => set(i, { label: e.target.value })} />
                  : <>
                    <NumberInput label={`Niveau ${n}, petite blinde`} value={l.sb} onChange={x => set(i, { sb: x ?? 0 })} />
                    <NumberInput label={`Niveau ${n}, grosse blinde`} value={l.bb} onChange={x => set(i, { bb: x ?? 0, ...(l.sb * 2 === l.bb ? { sb: (x ?? 0) / 2 } : {}), ...(l.ante === l.bb && l.ante > 0 ? { ante: x ?? 0 } : {}) })} />
                    <NumberInput label={`Niveau ${n}, ante`} value={l.ante} onChange={x => set(i, { ante: x ?? 0 })} />
                  </>}
                <NumberInput label="Durée en minutes" min={1} value={l.minutes} onChange={x => set(i, { minutes: x ?? 1 })} />
                <span className="acts">
                  <button type="button" className="iconbtn opt" style={{ width: 34 }} disabled={i === 0} onClick={() => swap(i, i - 1)} aria-label="Monter"><Icon name="up" size={15} /></button>
                  <button type="button" className="iconbtn opt" style={{ width: 34 }} disabled={i === levels.length - 1} onClick={() => swap(i, i + 1)} aria-label="Descendre"><Icon name="down" size={15} /></button>
                  <button type="button" className="iconbtn danger" style={{ width: 34 }} onClick={() => onChange(levels.filter((_, j) => j !== i))} aria-label="Supprimer"><Icon name="trash" size={15} /></button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="row">
        <button type="button" className="btn sm" onClick={() => insert(levels.length, nextLevel())}><Icon name="plus" size={15} />Niveau</button>
        <button type="button" className="btn sm" onClick={() => insert(levels.length, { kind: 'break', sb: 0, bb: 0, ante: 0, minutes: 10, label: 'Pause' })}><Icon name="plus" size={15} />Pause</button>
        {levels.length > 0 && <BulkMinutes onApply={m => onChange(levels.map(l => l.kind === 'level' ? { ...l, minutes: m } : l))} />}
      </div>
      {generating && <Generator players={players} stack={stack} hasLevels={levels.length > 0} onClose={() => setGenerating(false)} onDone={l => { onChange(l); setGenerating(false); }} />}
    </div>
  );
}

function BulkMinutes({ onApply }: { onApply: (m: number) => void }) {
  const [m, setM] = useState<number | null>(15);
  return (
    <span className="row" style={{ marginLeft: 'auto' }}>
      <span className="muted">Tous les niveaux à</span>
      <NumberInput label="Durée de tous les niveaux" value={m} min={1} max={180} onChange={setM} width={74} />
      <button type="button" className="btn sm" disabled={!m} onClick={() => onApply(m!)}>min, appliquer</button>
    </span>
  );
}

export function Generator({ players, stack, hasLevels, onDone, onClose }: { players: number; stack: number; hasLevels: boolean; onDone: (l: Level[]) => void; onClose: () => void }) {
  const [g, setG] = useState<GeneratorInput>({ ...PRESETS[1].input, players, stack });
  const set = (p: Partial<GeneratorInput>) => setG(x => ({ ...x, ...p }));
  const levels = generateLevels(g);
  const est = estimateMinutes(levels, g.players, g.stack);
  const shown = levels.filter(l => l.kind === 'level');
  return (
    <Modal title="Générer une structure" onClose={onClose} wide>
      <div className="stack">
        <div className="row">
          {PRESETS.map(p => <button key={p.name} type="button" className="btn sm" onClick={() => set({ ...p.input, players: g.players, stack: p.stack })}>{p.name}</button>)}
        </div>
        <div className="form three">
          <Field label="Joueurs"><NumberInput value={g.players} min={2} max={500} onChange={x => set({ players: x ?? 2 })} /></Field>
          <Field label="Tapis de départ"><NumberInput value={g.stack} min={100} step={100} onChange={x => set({ stack: x ?? 1000 })} /></Field>
          <Field label="Durée visée (minutes)"><NumberInput value={g.totalMinutes} min={30} max={900} step={15} onChange={x => set({ totalMinutes: x ?? 180 })} /></Field>
          <Field label="Minutes par niveau"><NumberInput value={g.levelMinutes} min={1} max={90} onChange={x => set({ levelMinutes: x ?? 15 })} /></Field>
          <Field label="Première grosse blinde"><NumberInput value={g.startBB} min={2} onChange={x => set({ startBB: x ?? 100 })} /></Field>
          <Field label="Plus petit jeton"><NumberInput value={g.smallestChip} min={1} onChange={x => set({ smallestChip: x ?? 25 })} /></Field>
          <Field label="Pause tous les (niveaux)" hint="0 : pas de pause"><NumberInput value={g.breakEvery} max={20} onChange={x => set({ breakEvery: x ?? 0 })} /></Field>
          <Field label="Durée des pauses (min)"><NumberInput value={g.breakMinutes} min={1} max={60} onChange={x => set({ breakMinutes: x ?? 10 })} /></Field>
          {g.ante === 'bb' && <Field label="Ante à partir du niveau"><NumberInput value={g.anteFrom} min={1} max={20} onChange={x => set({ anteFrom: x ?? 1 })} /></Field>}
        </div>
        <Choice label="Ante" value={g.ante} onChange={ante => set({ ante })} options={[
          { value: 'bb', label: 'Ante de grosse blinde', hint: 'Payée par la grosse blinde, une fois par main' },
          { value: 'none', label: 'Sans ante' },
        ]} />
        <div className="card" style={{ background: 'var(--bg)' }}>
          <p className="muted tnum">{shown.map(l => f.num(l.bb)).join(' · ')}</p>
          <p style={{ marginTop: 8, fontWeight: 600 }}>{est ? `Fin probable après ${f.duration(est)}.` : 'Trop lente : raccourcis les niveaux ou réduis le tapis.'}</p>
        </div>
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="button" className="btn primary" onClick={() => onDone(levels)}>{hasLevels ? 'Remplacer les niveaux' : 'Utiliser cette structure'}</button>
        </div>
      </div>
    </Modal>
  );
}

export function ChipsEditor({ chips, onChange, stack }: { chips: Chip[]; onChange: (c: Chip[]) => void; stack: number }) {
  const set = (i: number, p: Partial<Chip>) => onChange(chips.map((c, j) => j === i ? { ...c, ...p } : c));
  const total = chipsTotal(chips);
  return (
    <div className="stack" style={{ gap: 10 }}>
      {chips.length === 0 && <p className="muted">Les jetons s'affichent sur l'écran d'horloge, pour que tout le monde connaisse leur valeur.</p>}
      {chips.map((c, i) => (
        <div className="row" key={i} style={{ flexWrap: 'nowrap' }}>
          <input type="color" value={c.color} aria-label="Couleur du jeton" onChange={e => set(i, { color: e.target.value })} />
          <NumberInput label="Valeur du jeton" value={c.value} min={1} onChange={x => set(i, { value: x ?? 1 })} />
          <span className="muted">x</span>
          <NumberInput label="Nombre par joueur" value={c.count} max={200} onChange={x => set(i, { count: x ?? 0 })} width={80} />
          <button type="button" className="iconbtn danger" onClick={() => onChange(chips.filter((_, j) => j !== i))} aria-label="Retirer ce jeton"><Icon name="trash" size={15} /></button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn sm" onClick={() => onChange([...chips, { value: (chips.at(-1)?.value ?? 5) * 5, color: '#0FC6CC', count: 0 }])}><Icon name="plus" size={15} />Jeton</button>
        {chips.length === 0 && <button type="button" className="btn sm" onClick={() => onChange(DEFAULT_CHIPS)}>Mallette type</button>}
        {total > 0 && <span className={`tag ${total === stack ? 'open' : ''}`}>{f.num(total)} distribués{total !== stack && ` pour un tapis de ${f.num(stack)}`}</span>}
      </div>
    </div>
  );
}
