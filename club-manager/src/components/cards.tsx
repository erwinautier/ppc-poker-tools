import { api, useClub, useNow } from '../lib/club';
import { STATUS_LABEL, type Entry, type Tournament } from '../lib/types';
import * as f from '../lib/format';
import { participants, replay } from '../lib/engine';
import { Digits, levelTitle, viewOf } from './clockui';
import { useAction, useConfirm } from './ui';
import type { Knockout } from '../lib/types';

export function StatusTag({ status }: { status: Tournament['status'] }) {
  const cls = status === 'running' ? 'live' : status === 'open' ? 'open' : status === 'finished' ? 'done' : '';
  return <span className={`tag ${cls}`}>{STATUS_LABEL[status]}</span>;
}

/** S'inscrire, se désinscrire, liste d'attente. */
export function RegisterButton({ t, entries, reload, big }: { t: Tournament; entries: Entry[]; reload: () => Promise<void>; big?: boolean }) {
  const { me, user, account } = useClub();
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const mine = me ? entries.find(e => e.member_id === me.id && e.status !== 'cancelled') : undefined;
  const taken = entries.filter(e => e.status === 'registered').length;
  const full = t.max_players !== null && taken >= t.max_players;
  const cls = `btn ${big ? '' : 'sm'}`;

  if (!['open', 'closed'].includes(t.status)) return null;
  if (!me) {
    if (t.status !== 'open' || account === 'ok' || account === 'refused') return null;
    return <a className={cls} href="#/compte">{user ? 'Compte à valider' : 'Se connecter pour s\'inscrire'}</a>;
  }
  if (mine) {
    const rank = mine.status === 'waitlist'
      ? entries.filter(e => e.status === 'waitlist' && e.registered_at <= mine.registered_at).length : 0;
    return (
      <span className="row">
        <span className={`tag ${mine.status === 'registered' ? 'open' : ''}`}>
          {mine.status === 'registered' ? 'Tu participes' : `Liste d'attente, ${f.ordinal(rank)}`}
        </span>
        <button className={cls} disabled={busy} onClick={async () => {
          if (!await confirm({ title: 'Te désinscrire ?', text: `${t.name}, ${f.date(t.starts_at)}.`, ok: 'Me désinscrire', danger: true })) return;
          await run(async () => { await api.rpc('club_unregister', { p_tournament: t.id }); await reload(); }, 'Inscription annulée.');
        }}>Me désinscrire</button>
      </span>
    );
  }
  if (t.status !== 'open') return null;
  return (
    <button className={`${cls} primary`} disabled={busy} onClick={() => run(async () => {
      await api.rpc('club_register', { p_tournament: t.id });
      await reload();
    }, full ? 'Tu es sur la liste d\'attente.' : 'Inscription enregistrée.')}>
      {full ? 'Liste d\'attente' : 'M\'inscrire'}
    </button>
  );
}

export function TournamentRow({ t, entries, championship, reload, winner }: {
  t: Tournament; entries?: Entry[]; championship?: string; reload?: () => Promise<void>; winner?: string;
}) {
  const d = new Date(t.starts_at);
  const taken = entries?.filter(e => e.status === 'registered').length ?? 0;
  const waiting = entries?.filter(e => e.status === 'waitlist').length ?? 0;
  return (
    <div className="titem">
      <a className="tdate" href={`#/t/${t.id}`} tabIndex={-1} aria-hidden="true">
        <b>{d.getDate()}</b><span>{d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</span>
      </a>
      <div style={{ minWidth: 0 }}>
        <h3><a href={`#/t/${t.id}`}>{t.name}</a></h3>
        <div className="meta">
          <span>{d.toLocaleDateString('fr-FR', { weekday: 'long' })} {f.time(t.starts_at)}</span>
          {t.venue && <span>{t.venue}</span>}
          {championship && <span>{championship}</span>}
          {entries && t.status !== 'finished' && (
            <span className="tnum">{t.max_players ? `${taken} / ${t.max_players} places` : f.plural(taken, 'inscription')}{waiting > 0 && ` + ${waiting} en attente`}</span>
          )}
          {winner && <span>Vainqueur : <b>{winner}</b></span>}
        </div>
      </div>
      <div className="side">
        {t.status !== 'open' && <StatusTag status={t.status} />}
        {entries && reload && <RegisterButton t={t} entries={entries} reload={reload} />}
      </div>
    </div>
  );
}

/** Tournoi en cours : horloge en direct. */
export function LiveTicket({ t, entries, knockouts }: { t: Tournament; entries: Entry[]; knockouts: Knockout[] }) {
  const now = useNow(500);
  const v = viewOf(t, now);
  const r = replay(participants(t, entries), knockouts, t.settings);
  return (
    <a className="ticket" href={`#/t/${t.id}/direct`}>
      <div>
        <div className="row" style={{ marginBottom: 6 }}><StatusTag status="running" /><span className="muted">{levelTitle(t.levels, v)}{!v.running && ' · horloge arrêtée'}</span></div>
        <h2>{t.name}</h2>
        <p className="muted" style={{ marginTop: 4 }}>{f.plural(r.alive.length, 'joueur')} en course sur {r.total}</p>
      </div>
      <div className="big">
        <Digits text={f.clock(v.remainingMs)} className="time" />
        {v.level?.kind === 'level' && <span className="bl">{f.blinds(v.level)}</span>}
      </div>
    </a>
  );
}
