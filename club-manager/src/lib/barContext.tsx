/** Les données de la buvette, partagées par le menu, l'accueil, le rappel et les pages. */
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { bar, useClub, useLoad, type Loaded } from './club';
import type { BarData } from './bar';
import { useToast } from '../components/ui';

const Ctx = createContext<Loaded<BarData | null>>({ data: null, error: null, loading: false, reload: async () => {} });
/** data nul : pas connecté, ou script 003 pas encore exécuté. */
export const useBar = () => useContext(Ctx);

/** Relit au bon moment : signal de la base, retour sur l'onglet, retour du réseau, et de temps en temps. */
export function useBarRefresh(on: boolean, reload: () => Promise<void>, every: number) {
  useEffect(() => {
    if (!on) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => void reload(), 150); };
    const back = () => { if (document.visibilityState === 'visible') soon(); };
    const stop = bar.watch(soon);
    const poll = setInterval(back, every);
    document.addEventListener('visibilitychange', back);
    window.addEventListener('online', back);
    return () => {
      stop(); clearInterval(poll); clearTimeout(timer);
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('online', back);
    };
  }, [on, reload, every]);
}

export function BarProvider({ children }: { children: ReactNode }) {
  const { me, kiosk } = useClub();
  const toast = useToast();
  const q = useLoad<BarData | null>(() => me && !kiosk ? bar.load() : Promise.resolve(null), [me?.id, me?.role, me?.treasurer, kiosk]);
  useBarRefresh(!!q.data, q.reload, 60_000);
  useEffect(() => {
    const lost = (e: Event) => toast(`Conso non enregistrée. ${(e as CustomEvent<string>).detail}`, 'error');
    window.addEventListener('bar-lost', lost);
    return () => window.removeEventListener('bar-lost', lost);
  }, [toast]);
  return <Ctx.Provider value={q}>{children}</Ctx.Provider>;
}
