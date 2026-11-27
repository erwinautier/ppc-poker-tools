/** Compte connecté (session partagée avec la suite) et contexte du tournoi tenu à jour. */
import { useEffect, useState } from 'react';
import { club, type User } from './club';
import { clubLevel } from './levels';
import { getCarnet, setCtx, useCarnet } from './store';

let known: User | null | undefined;
const subs = new Set<(u: User | null) => void>();
let started = false;
function startAuth() {
  if (started) return;
  started = true;
  void club.user().then(u => { known = u; subs.forEach(f => f(u)); }).catch(() => { known = null; subs.forEach(f => f(null)); });
  club.onAuth(u => { known = u; subs.forEach(f => f(u)); });
}

/** undefined tant qu'on ne sait pas encore. */
export function useUser(): User | null | undefined {
  const [u, setU] = useState<User | null | undefined>(known);
  useEffect(() => {
    startAuth();
    subs.add(setU);
    if (known !== undefined) setU(known);
    return () => { subs.delete(setU); };
  }, []);
  return u;
}

/**
 * Tournoi du club suivi à l'horloge : les blindes du contexte suivent le niveau en cours
 * (au chargement, puis chaque minute), sauf si on les a changées à la main.
 */
export function useLiveCtx() {
  const { ctx } = useCarnet();
  const follow = ctx.kind === 'club' && !ctx.manual && !!ctx.tournamentId;
  useEffect(() => {
    if (!follow) return;
    let stop = false;
    const tick = async () => {
      const list = await club.running().catch(() => []);
      const cur = getCarnet().ctx;
      const t = list.find(x => x.id === cur.tournamentId);
      if (stop || !t || cur.kind !== 'club' || cur.manual) return;
      const l = clubLevel(t);
      if (!l) return;
      const b = { ...l.blinds, anteMode: cur.blinds.anteMode };
      if (l.level !== cur.level || b.sb !== cur.blinds.sb || b.bb !== cur.blinds.bb || b.ante !== cur.blinds.ante) {
        setCtx({ ...cur, level: l.level, blinds: b });
      }
    };
    void tick();
    const id = setInterval(() => { if (document.visibilityState === 'visible') void tick(); }, 60_000);
    const back = () => { if (document.visibilityState === 'visible') void tick(); };
    document.addEventListener('visibilitychange', back);
    return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', back); };
  }, [follow]);
}
