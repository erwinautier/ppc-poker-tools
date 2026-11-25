import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/club';
import { back, clockOf, goTo, levelNumber, nudge, pause, play, readClock, type ClockCommand, type ClockView } from '../lib/clock';
import * as f from '../lib/format';
import { saveSoundPrefs, say, soundPrefs, sounds, unlock, type SoundPrefs } from '../lib/sound';
import type { Level, Tournament } from '../lib/types';
import { Icon, useAction } from './ui';

/** Chiffres à largeur fixe : l'horloge ne tremble pas. */
export function Digits({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`digits ${className}`} role="timer" aria-label={text}>
      {[...text].map((c, i) => <span key={i} className={c === ':' ? 'sep' : ''} aria-hidden="true">{c}</span>)}
    </span>
  );
}

/** La frise du club se remplit au fil du niveau. */
export function Frise({ progress }: { progress: number }) {
  return (
    <div className="frise" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-label="Avancement du niveau">
      <i style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }} />
    </div>
  );
}

export function viewOf(t: Tournament, now: number): ClockView {
  return readClock(t.levels, clockOf(t), now);
}

export function levelTitle(levels: Level[], v: ClockView): string {
  if (!v.level) return 'Aucune structure';
  return v.level.kind === 'break' ? v.level.label || 'Pause' : `Niveau ${levelNumber(levels, v.index)}`;
}

export function MiniClock({ t, v }: { t: Tournament; v: ClockView }) {
  const started = t.status === 'running' || v.running;
  const cls = v.level?.kind === 'break' ? 'break' : '';
  return (
    <div className={`mini ${cls} ${v.running ? '' : 'paused'}`}>
      <div className="lv">{levelTitle(t.levels, v)}{!v.running && started && ' · horloge arrêtée'}</div>
      <Digits text={f.clock(v.remainingMs)} className={`time ${v.remainingMs > 3_599_000 ? 'long' : ''}`} />
      <Frise progress={v.progress} />
      {v.level?.kind === 'level' && (
        <div className="bl">{f.blinds(v.level)}{v.level.ante > 0 && <small>Ante {f.num(v.level.ante)}</small>}</div>
      )}
      {v.next && <div className="nx">Ensuite : {f.blinds(v.next)}{v.next.ante > 0 ? ` (ante ${f.num(v.next.ante)})` : ''}</div>}
    </div>
  );
}

/** Envoie une commande d'horloge et affiche l'erreur éventuelle. */
export function useClockCommands(t: Tournament | null, v: ClockView | null, reload: () => Promise<void>) {
  const [run, busy] = useAction();
  const send = (c: ClockCommand) => run(async () => {
    await api.rpc('club_set_clock', { p_tournament: t!.id, p_level: c.level, p_elapsed_ms: c.elapsedMs, p_running: c.running });
    await reload();
  });
  return {
    busy,
    toggle: () => { if (t && v) void send(v.running ? pause(v) : play(v)); },
    next: () => { if (t && v) void send(goTo(v, t.levels, v.index + 1)); },
    prev: () => { if (t && v) void send(back(v, t.levels)); },
    add: (ms: number) => { if (t && v) void send(nudge(v, ms)); },
    jump: (i: number) => { if (t && v) void send(goTo(v, t.levels, i)); },
  };
}
export type ClockCommands = ReturnType<typeof useClockCommands>;

export function ClockControls({ c, v }: { c: ClockCommands; v: ClockView }) {
  return (
    <div className="controls">
      <button className="btn" onClick={c.prev} disabled={c.busy} aria-label="Niveau précédent" title="Début du niveau, puis niveau précédent"><Icon name="prev" /></button>
      <button className="btn" onClick={() => c.add(-60_000)} disabled={c.busy}>−1 min</button>
      <button className="btn primary big" onClick={c.toggle} disabled={c.busy}>
        <Icon name={v.running ? 'pause' : 'play'} />{v.running ? 'Arrêter' : 'Lancer'}
      </button>
      <button className="btn" onClick={() => c.add(60_000)} disabled={c.busy}>+1 min</button>
      <button className="btn" onClick={c.next} disabled={c.busy || !v.next} aria-label="Niveau suivant"><Icon name="next" /></button>
    </div>
  );
}

// ── Sons ─────────────────────────────────────────────────────────────────────
export function useSound(): [SoundPrefs, (p: Partial<SoundPrefs>) => void] {
  const [prefs, setPrefs] = useState(soundPrefs);
  useEffect(() => {
    // Préférence mémorisée : le premier geste débloque le son.
    if (!prefs.on) return;
    const on = () => unlock();
    window.addEventListener('pointerdown', on, { once: true });
    window.addEventListener('keydown', on, { once: true });
    return () => { window.removeEventListener('pointerdown', on); window.removeEventListener('keydown', on); };
  }, [prefs.on]);
  return [prefs, p => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    saveSoundPrefs(next);
    if (next.on) unlock();
  }];
}

export function spoken(levels: Level[], v: ClockView): string {
  if (!v.level) return '';
  if (v.level.kind === 'break') return `${v.level.label || 'Pause'}, ${v.level.minutes} minutes.`;
  const ante = v.level.ante > 0 ? `, ante ${v.level.ante}` : '';
  return `Niveau ${levelNumber(levels, v.index)}. Blindes ${v.level.sb}, ${v.level.bb}${ante}.`;
}

/** Changement de niveau, dernière minute, trois dernières secondes. */
export function useClockSounds(levels: Level[], v: ClockView | null, on: boolean) {
  const last = useRef<{ index: number; s: number } | null>(null);
  useEffect(() => {
    if (!v?.level) return;
    const s = Math.ceil(v.remainingMs / 1000);
    const before = last.current;
    last.current = { index: v.index, s };
    if (!before || !on || !v.running) return;
    if (before.index !== v.index) {
      if (v.level.kind === 'break') sounds.pause(); else sounds.level();
      const text = spoken(levels, v);
      setTimeout(() => say(text), 1500);
      return;
    }
    if (before.s > 60 && s <= 60 && v.level.minutes > 1) {
      sounds.minute();
      setTimeout(() => say('Dernière minute.'), 700);
    }
    if (before.s !== s && s >= 1 && s <= 3) sounds.countdown();
  });
}
