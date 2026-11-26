import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { getDA, logoFile, subscribeDA } from '../../../shared/ppc-da.js';
import { useClub, useNow, useTournament, useWakeLock, type TournamentBundle } from '../lib/club';
import { chipCount, participants, payouts, replay } from '../lib/engine';
import * as f from '../lib/format';
import { sounds } from '../lib/sound';
import { Digits, Frise, levelTitle, useClockCommands, useClockSounds, useSound, viewOf } from '../components/clockui';
import { ChipDot, Empty, Icon, Qr, State } from '../components/ui';
import { bountyValue } from '../components/t/Live';
import { shareUrl } from './Tournament';

export function ClockScreen({ id }: { id: string }) {
  const { isStaff } = useClub();
  const q = useTournament(id, isStaff);
  if (!q.data) return <div className="main"><State loading={q.loading} error={q.error} onRetry={q.reload} /></div>;
  if (q.data === 'missing') return <div className="main"><Empty title="Tournoi introuvable"><a className="btn" href="#/">Accueil</a></Empty></div>;
  return <Screen b={q.data} reload={q.reload} isStaff={isStaff} offline={q.error} />;
}

/** Barre de commandes et pointeur masqués après quelques secondes sans geste. */
function useIdle(ms: number): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), ms);
    const wake = () => { setIdle(false); clearTimeout(timer); timer = setTimeout(() => setIdle(true), ms); };
    const events = ['pointermove', 'pointerdown', 'keydown', 'focusin'] as const;
    events.forEach(e => window.addEventListener(e, wake));
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, wake)); };
  }, [ms]);
  return idle;
}

function Screen({ b, reload, isStaff, offline }: { b: TournamentBundle; reload: () => Promise<void>; isStaff: boolean; offline: string | null }) {
  const da = useSyncExternalStore(subscribeDA, getDA);
  const { t, entries, knockouts } = b;
  const now = useNow(200);
  const v = viewOf(t, now);
  const c = useClockCommands(t, v, reload);
  const [prefs, setPrefs] = useSound();
  const idle = useIdle(6000);
  const [splash, setSplash] = useState<{ name: string; text: string } | null>(null);
  useWakeLock(true);
  useClockSounds(t.levels, t.status === 'running' ? v : null, prefs.on);

  const inPlay = useMemo(() => participants(t, entries), [t, entries]);
  const r = useMemo(() => replay(inPlay, knockouts, t.settings), [inPlay, knockouts, t.settings]);
  const prizes = useMemo(() => payouts(t, inPlay), [t, inPlay]);
  const chips = chipCount(t, inPlay, r.alive.length, v.level?.bb ?? 0);
  const hunters = r.players.filter(p => p.kos > 0).sort((a, z) => z.kos - a.kos || z.bountyWon - a.bountyWon).slice(0, 4);

  // Annonce d'une élimination survenue pendant que l'écran est affiché.
  const seen = useRef(Math.max(0, ...knockouts.map(k => k.seq)));
  useEffect(() => {
    const last = knockouts.at(-1);
    if (!last || last.seq <= seen.current) { if (last) seen.current = Math.max(seen.current, last.seq); return; }
    seen.current = last.seq;
    const p = r.byId.get(last.victim_id);
    if (!p) return;
    const killers = last.killer_ids.map(x => r.byId.get(x)?.entry.name).filter(Boolean).join(' et ');
    setSplash({ name: p.entry.name, text: `${last.rebuy ? 'recave' : `termine ${f.ordinal(p.position!)}`}${killers ? `, KO par ${killers}` : ''}` });
    if (prefs.on) sounds.knockout();
  }, [knockouts, r, prefs.on]);
  useEffect(() => {
    if (!splash) return;
    const timer = setTimeout(() => setSplash(null), 5000);
    return () => clearTimeout(timer);
  }, [splash]);

  const cmd = useRef(c);
  cmd.current = c;
  useEffect(() => {
    if (!isStaff || t.status === 'finished') return;
    const on = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('button, a, input')) return;
      if (e.code === 'Space') { e.preventDefault(); cmd.current.toggle(); }
      if (e.code === 'ArrowRight') cmd.current.next();
      if (e.code === 'ArrowLeft') cmd.current.prev();
      if (e.code === 'ArrowUp') { e.preventDefault(); cmd.current.add(60_000); }
      if (e.code === 'ArrowDown') { e.preventDefault(); cmd.current.add(-60_000); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [isStaff, t.status]);

  const full = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); };
  const isBreak = v.level?.kind === 'break';
  const lastMinute = v.running && !isBreak && v.remainingMs <= 60_000 && !v.overtime;
  const winner = t.status === 'finished' ? entries.find(e => e.final_position === 1)?.name : r.alive.length === 1 && r.total > 1 ? r.alive[0].entry.name : null;

  return (
    <div className={`tv ${isBreak ? 'break' : ''} ${lastMinute ? 'last' : ''} ${idle ? 'idle' : ''}`}>
      <div className="ppc-stripe" aria-hidden="true" />
      <header className="tv-head">
        <img src={`${import.meta.env.BASE_URL}${logoFile(da)}`} alt="Penthièvre Poker Club" />
        <div style={{ minWidth: 0 }}>
          <h1>{t.name}</h1>
          <p>{[b.championship?.name, t.venue].filter(Boolean).join(' · ') || 'Penthièvre Poker Club'}</p>
        </div>
        <span className="spacer" />
        {offline && <span className="tag live">Hors ligne</span>}
      </header>

      <div className="tv-body">
        <div className="tv-center">
          {winner ? (
            <>
              <div className="tv-level">Vainqueur</div>
              <div className="tv-blinds">{winner}</div>
              <div className="tv-ante">{f.plural(r.total || entries.filter(e => e.final_position !== null).length, 'joueur')}</div>
            </>
          ) : (
            <>
              <div className="tv-level">{levelTitle(t.levels, v)}</div>
              <Digits text={f.clock(v.remainingMs)} className={`tv-time ${v.remainingMs > 3_599_000 ? 'long' : ''}`} />
              <Frise progress={v.progress} />
              {!v.running && <div className="tv-state">{t.status === 'running' ? 'Horloge arrêtée' : `Début à ${f.time(t.starts_at)}`}</div>}
              {isBreak
                ? v.next && <><div className="tv-ante">À la reprise</div><div className="tv-blinds">{f.blinds(v.next)}</div>{v.next.ante > 0 && <div className="tv-ante">Ante {f.num(v.next.ante)}</div>}</>
                : <><div className="tv-blinds">{f.blinds(v.level)}</div>{v.level && v.level.ante > 0 && <div className="tv-ante">Ante {f.num(v.level.ante)}</div>}</>}
            </>
          )}
        </div>

        <div className="tv-side l">
          <div className="tv-fact"><span>Joueurs</span><b>{r.alive.length} <small>/ {r.total}</small></b></div>
          <div className="tv-fact"><span>Tapis moyen</span><b>{f.chips(chips.avgStack)}</b>{chips.avgBB !== null && !isBreak && <small>{f.num(chips.avgBB)} BB</small>}</div>
          <div className="tv-fact"><span>Jetons en jeu</span><b>{f.chips(chips.totalChips)}</b></div>
          {v.toBreakMs !== null && <div className="tv-fact"><span>Prochaine pause</span><b>{f.duration(Math.ceil(v.toBreakMs / 60_000))}</b></div>}
        </div>

        <div className="tv-side r">
          {v.next && !isBreak && <div className="tv-fact next"><span>Niveau suivant</span><b>{f.blinds(v.next)}</b>{v.next.ante > 0 && <small>ante {f.num(v.next.ante)}</small>}</div>}
          {prizes.length > 0 && <div className="tv-fact"><span>Dotation</span><ul className="tv-list">{prizes.slice(0, 5).map(p => <li key={p.place}><span className="pl">{f.ordinal(p.place)}</span><b>{p.label || f.eur(p.amount!)}</b></li>)}</ul></div>}
          {hunters.length > 0 && <div className="tv-fact"><span>Chasseurs</span><ul className="tv-list">{hunters.map(p => <li key={p.entry.id}><span>{p.entry.name}</span><b style={{ whiteSpace: 'nowrap' }}>{f.num(p.kos)}{t.settings.bounty.mode !== 'none' && p.bountyWon > 0 ? ` · ${bountyValue(t, p.bountyWon)}` : ''}</b></li>)}</ul></div>}
          <div className="tv-fact tv-qr" style={{ display: 'flex', gap: '1.4vmin', alignItems: 'center' }}>
            <Qr text={shareUrl(t.id)} size={96} />
            <span>Suis le tournoi<br />sur ton téléphone</span>
          </div>
        </div>
      </div>

      <footer className="tv-foot">
        {t.chips.map((x, i) => <span key={i} className="tnum"><ChipDot color={x.color} />{f.num(x.value)}</span>)}
      </footer>

      <div className="tv-bar no-print">
        <a className="btn" href={`#/t/${t.id}`}><Icon name="back" />Quitter</a>
        {isStaff && t.status !== 'finished' && t.status !== 'cancelled' && t.levels.length > 0 && (
          <>
            <button className="btn" onClick={c.prev} disabled={c.busy} aria-label="Niveau précédent" title="Niveau précédent (flèche gauche)"><Icon name="prev" /></button>
            <button className="btn" onClick={() => c.add(-60_000)} disabled={c.busy}>−1 min</button>
            <button className="btn primary" onClick={c.toggle} disabled={c.busy} title="Barre d'espace"><Icon name={v.running ? 'pause' : 'play'} />{v.running ? 'Arrêter' : 'Lancer'}</button>
            <button className="btn" onClick={() => c.add(60_000)} disabled={c.busy}>+1 min</button>
            <button className="btn" onClick={c.next} disabled={c.busy || !v.next} aria-label="Niveau suivant" title="Niveau suivant (flèche droite)"><Icon name="next" /></button>
            <a className="btn" href={`#/t/${t.id}/direct`}><Icon name="skull" />Éliminations</a>
          </>
        )}
        <button className="btn" onClick={() => setPrefs({ on: !prefs.on })} aria-pressed={prefs.on}><Icon name={prefs.on ? 'sound' : 'mute'} />{prefs.on ? 'Son activé' : 'Son coupé'}</button>
        {prefs.on && (
          <>
            <button className="btn" onClick={() => setPrefs({ voice: !prefs.voice })} aria-pressed={prefs.voice}>Voix : {prefs.voice ? 'oui' : 'non'}</button>
            <input type="range" min={0} max={1} step={0.05} value={prefs.volume} aria-label="Volume" onChange={e => setPrefs({ volume: Number(e.target.value) })} onPointerUp={() => sounds.minute()} />
          </>
        )}
        <button className="btn" onClick={full}><Icon name="expand" />Plein écran</button>
      </div>

      {splash && <div className="tv-ko" role="status" onClick={() => setSplash(null)}><b>{splash.name}</b><span>{splash.text}</span></div>}
    </div>
  );
}
