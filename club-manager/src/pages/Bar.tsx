import { useEffect, useState } from 'react';
import { bar, isDemo, listMembers, useClub, useLoad } from '../lib/club';
import { useBar } from '../lib/barContext';
import { kioskLink } from '../lib/kiosk';
import { useRoute } from '../lib/router';
import * as b from '../lib/bar';
import type { BarData, BarItem, BarLine, BarPayment, Kiosk, PayMethod, Slate } from '../lib/bar';
import { key } from '../lib/accounts';
import * as f from '../lib/format';
import { messageOf } from '../lib/api';
import { Choice, Empty, Field, Icon, Modal, NumberInput, Qr, State, Switch, useAction, useConfirm, useToast } from '../components/ui';

const when = (iso: string) => `${f.shortDate(iso)} à ${f.time(iso)}`;
const METHODS = (Object.keys(b.METHOD) as PayMethod[]).map(value => ({ value, label: b.METHOD[value] }));

export function BarPage({ tab }: { tab: string }) {
  const { me, user, isAdmin, isStaff } = useClub();
  const { data: d, loading, error, reload } = useBar();
  if (!me) return <Empty title="Réservé aux adhérents">{!user && <a className="btn primary" href="#/compte">Se connecter</a>}</Empty>;
  if (!d) {
    if (loading || error) return <State loading={loading} error={error} onRetry={reload} />;
    return <Empty title="La buvette n'est pas encore ouverte">{isAdmin && <>Exécute <code>club-manager/supabase/003_club_bar.sql</code> dans Supabase (SETUP.md).</>}</Empty>;
  }
  const toCheck = d.validate ? d.team?.pending.length ?? 0 : 0;
  const tabs = [
    ['', 'Mon ardoise'],
    ...(d.manage ? [['suivi', 'Suivi'], ['bilan', 'Bilan'], ['tarifs', 'Tarifs et réglages']] : []),
  ];
  const current = tabs.some(([k]) => k === tab) ? tab : '';
  return (
    <>
      <div className="pagehead">
        <div><h1>Buvette</h1></div>
        {d.manage && <a className="btn" href="#/buvette/comptoir"><Icon name="expand" />Ouvrir le comptoir</a>}
      </div>
      {tabs.length > 1 && (
        <div className="tabs">
          {tabs.map(([k, label]) => <a key={k} href={`#/buvette${k ? `/${k}` : ''}`} className={k === current ? 'on' : ''}>{label}{k === 'suivi' && toCheck > 0 && <> <span className="badge">{toCheck}</span></>}</a>)}
        </div>
      )}
      {current === '' && <MySlate d={d} reload={reload} />}
      {current === 'suivi' && d.team && <Follow d={d} team={d.team} reload={reload} />}
      {current === 'bilan' && d.team && <Report slates={d.team.slates} />}
      {current === 'tarifs' && <Prices d={d} isStaff={isStaff} reload={reload} />}
    </>
  );
}

// ── Mon ardoise ──────────────────────────────────────────────────────────────

/** Consos gardées sur l'appareil, envoyées dès que le réseau revient. */
export function Queued({ n }: { n: number }) {
  return n > 0 ? <span className="tag" title="Gardées sur cet appareil, envoyées dès que le réseau revient">{f.plural(n, 'conso')} en attente de réseau</span> : null;
}

/** Noter une conso, avec un « Annuler » immédiat. */
export function useTake(reload: () => Promise<void>) {
  const toast = useToast();
  return async (memberId: string, item: BarItem, guest: boolean, who?: string) => {
    try {
      const { id, queued } = await bar.take(memberId, item, guest);
      await reload();
      toast(`${who ? `${who} : ` : ''}${item.name}${guest ? ' (invité)' : ''}, ${b.money(item.price)}.${queued ? ' En attente de réseau.' : ''}`, 'ok', {
        label: 'Annuler',
        run: () => void bar.undo(id).then(reload).catch(e => toast(messageOf(e), 'error')),
      });
    } catch (e) {
      toast(messageOf(e), 'error');
    }
  };
}

function MySlate({ d, reload }: { d: BarData; reload: () => Promise<void> }) {
  const route = useRoute();
  const [guest, setGuest] = useState(false);
  const [paying, setPaying] = useState(false);
  const [all, setAll] = useState(false);
  const take = useTake(reload);
  const [run, busy] = useAction();
  const s = d.slate, { lines, payments } = d;
  // Le rappel mène ici, fenêtre de paiement ouverte, même si la page était déjà affichée.
  useEffect(() => {
    if (!route.query.has('payer')) return;
    setPaying(true);
    history.replaceState(null, '', location.hash.split('?')[0]);
  }, [route]);
  const shown = all ? lines : lines.slice(0, 8);
  const now = Date.now();
  const items = d.items.filter(i => i.active);
  return (
    <div className="two">
      <div className="stack">
        <section className="card barhero">
          <div>
            <p className="muted">{s.due < 0 ? 'Tu as une avance de' : 'Ton ardoise'}</p>
            <p className="barsum">{b.money(Math.abs(s.due))}</p>
            {s.pending > 0 && <p className="muted">dont {b.money(s.pending)} en attente de validation</p>}
            <Queued n={d.queued} />
          </div>
          {s.open > 0 && <button className="btn primary big" onClick={() => setPaying(true)}><Icon name="check" />J'ai payé</button>}
        </section>
        <section className="card">
          <div className="sechead" style={{ flexWrap: 'wrap' }}>
            <h2>Je prends</h2>
            {items.length > 0 && <button className={`toggle ${guest ? 'on' : ''}`} aria-pressed={guest} onClick={() => setGuest(!guest)}>Pour un invité</button>}
          </div>
          {guest && <p className="muted" style={{ marginBottom: 10 }}>La prochaine conso sera notée pour ton invité, sur ton ardoise.</p>}
          {items.length === 0 ? <Empty title="Aucun produit pour l'instant">{d.manage && <a className="btn" href="#/buvette/tarifs">Ajouter les produits</a>}</Empty> : (
            <div className="baritems">
              {items.map(i => (
                <button key={i.id} className="baritem" onClick={() => { void take(s.member_id, i, guest); setGuest(false); }}>
                  <span className="baremoji" aria-hidden="true">{i.emoji || '•'}</span>
                  <b>{i.name}</b>
                  <span>{b.money(i.price)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      <div className="stack">
        <section className="card">
          <h2>Mes consos</h2>
          {lines.length === 0 ? <Empty title="Rien pour l'instant" /> : (
            <div className="plist">
              {shown.map(l => <LineRow key={l.id} l={l} action={b.canUndo(l, now) && <button className="btn ghost sm" disabled={busy} onClick={() => run(async () => { await bar.undo(l.id); await reload(); })}>Annuler</button>} />)}
            </div>
          )}
          {lines.length > 8 && <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setAll(!all)}>{all ? 'Réduire' : `Afficher les ${lines.length} dernières`}</button>}
        </section>
        <section className="card">
          <h2>Mes paiements</h2>
          {payments.length === 0 ? <p className="muted">{d.settings.payInfo || 'Aucun paiement.'}</p> : (
            <div className="plist">
              {payments.map(p => <PayRow key={p.id} p={p} action={p.status === 'pending' && <button className="btn ghost sm" disabled={busy} onClick={() => run(async () => { await bar.withdraw(p.id); await reload(); }, 'Déclaration retirée.')}>Retirer</button>} />)}
            </div>
          )}
        </section>
      </div>
      {paying && <PayModal title="J'ai payé" ok="Déclarer" open={s.open} info={d.settings.payInfo} note="Ton solde baissera quand la trésorerie aura validé." onClose={() => setPaying(false)}
        onPay={async (amount, method) => { await bar.declare(amount, method); await reload(); }} done="Paiement déclaré, en attente de validation." />}
    </div>
  );
}

function LineRow({ l, action }: { l: BarLine; action?: React.ReactNode }) {
  return (
    <div className={`prow ${l.cancelled_at ? 'barcancel' : ''}`}>
      <span className="pname">{l.label}{l.guest && ' (invité)'}<small>{when(l.created_at)}{l.by && `, noté par ${l.by}`}{l.cancelled_at && ', annulé'}{l.queued && ', en attente de réseau'}</small></span>
      <span className="acts"><b className="tnum">{b.money(l.price)}</b>{action}</span>
    </div>
  );
}

const STATUS = { pending: ['À valider', ''], validated: ['Validé', 'open'], refused: ['Refusé', 'live'] } as const;
function PayRow({ p, action, who }: { p: BarPayment; action?: React.ReactNode; who?: string }) {
  const [label, cls] = STATUS[p.status];
  return (
    <div className="prow">
      <span className="pname">{who ?? b.METHOD[p.method]}<small>{who && `${b.METHOD[p.method]}, `}{when(p.created_at)}</small></span>
      <span className="acts"><b className="tnum">{b.money(p.amount)}</b>{(!who || p.status !== 'pending') && <span className={`tag ${cls}`}>{label}</span>}{action}</span>
    </div>
  );
}

function PayModal({ title, ok, open, info, note, done, onPay, onClose }: { title: string; ok: string; open: number; info?: string; note?: string; done: string; onPay: (amount: number, method: PayMethod) => Promise<void>; onClose: () => void }) {
  const [amount, setAmount] = useState<number | null>(open > 0 ? open / 100 : null);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [run, busy] = useAction();
  return (
    <Modal title={title} onClose={onClose}>
      <form className="stack" onSubmit={e => { e.preventDefault(); void run(() => onPay(b.cents(amount ?? 0), method), done).then(x => { if (x) onClose(); }); }}>
        {info && <p className="muted">{info}</p>}
        <Field label="Montant (€)" hint={open > 0 ? `Reste à payer : ${b.money(open)}` : 'Ce sera une avance.'}><NumberInput value={amount} step={0.01} min={0} max={1000} onChange={setAmount} /></Field>
        <Choice label="Moyen de paiement" value={method} onChange={setMethod} options={METHODS} />
        {note && <p className="muted">{note}</p>}
        <div className="row end"><button type="button" className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={busy || !amount}>{ok}{amount ? ` ${b.money(b.cents(amount))}` : ''}</button></div>
      </form>
    </Modal>
  );
}

// ── Suivi ────────────────────────────────────────────────────────────────────

function Follow({ d, team, reload }: { d: BarData; team: NonNullable<BarData['team']>; reload: () => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [onlyLate, setOnlyLate] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const toast = useToast();
  const now = Date.now(), meId = d.slate.member_id;
  const list = team.slates, pending = [...team.pending].reverse();
  const late = list.filter(s => b.isLate(s, d.settings, now));
  const canAsk = late.filter(s => s.account && s.active && s.reminder?.seen_at !== null && s.member_id !== meId);
  const total = list.reduce((n, s) => n + Math.max(0, s.due), 0);
  const waiting = pending.reduce((n, p) => n + p.amount, 0);
  const shown = (onlyLate ? late : list).filter(s => key(s.name).includes(key(search)));
  const open = list.find(s => s.member_id === detail);

  const remind = (ids: string[]) => run(async () => {
    const n = await bar.remind(ids);
    await reload();
    toast(n === 0 ? 'Aucun rappel à envoyer.' : `${f.plural(n, 'rappel')} envoyé${n > 1 ? 's' : ''}.`);
  });

  return (
    <div className="stack">
      <div className="barstats">
        <div><span>Reste dû</span><b>{b.money(total)}</b></div>
        <div><span>À valider</span><b>{b.money(waiting)}</b></div>
        <div><span>En retard</span><b>{late.length}</b></div>
      </div>
      {pending.length > 0 && (
        <section className="card note">
          <h2>{f.plural(pending.length, 'paiement')} à valider</h2>
          {!d.validate && <p className="muted">La trésorerie ou un administrateur les valide.</p>}
          <div className="plist">
            {pending.map(p => (
              <PayRow key={p.id} p={p} who={p.name} action={d.validate && (p.member_id === meId ? <span className="tag">À valider par quelqu'un d'autre</span> : <>
                <button className="btn ghost sm" disabled={busy} aria-label={`Refuser le paiement de ${p.name}`} onClick={async () => { if (await confirm({ title: 'Refuser ce paiement ?', text: `${p.name} devra toujours ${b.money(p.amount)}.`, ok: 'Refuser', danger: true })) void run(async () => { await bar.decide(p.id, false); await reload(); }, 'Paiement refusé.'); }}>Refuser</button>
                <button className="btn primary sm" disabled={busy} aria-label={`Valider le paiement de ${p.name}`} onClick={() => run(async () => { await bar.decide(p.id, true); await reload(); }, `${b.money(p.amount)} reçus de ${p.name}.`)}>Valider</button>
              </>)} />
            ))}
          </div>
        </section>
      )}
      <div className="row">
        <input style={{ maxWidth: 240 }} placeholder="Rechercher" aria-label="Rechercher un adhérent" value={search} onChange={e => setSearch(e.target.value)} />
        <button className={`toggle ${onlyLate ? 'on' : ''}`} aria-pressed={onlyLate} onClick={() => setOnlyLate(!onlyLate)}>En retard ({late.length})</button>
        <span className="spacer" />
        {d.validate && <button className="btn sm" onClick={() => setAdjusting(true)}>Reprise ou correction</button>}
        {canAsk.length > 1 && <button className="btn sm" disabled={busy} onClick={async () => { if (await confirm({ title: `Rappeler ${f.plural(canAsk.length, 'personne')} ?`, text: canAsk.map(s => `${s.name} (${b.money(s.open)})`).join(', ') + '.', ok: 'Envoyer les rappels' })) void remind(canAsk.map(s => s.member_id)); }}>Rappeler les retards ({canAsk.length})</button>}
      </div>
      <div className="card" style={{ paddingBlock: 6 }}>
        {shown.length === 0 ? <Empty title={list.length === 0 ? 'Aucune ardoise pour l\'instant' : 'Personne'} /> : (
          <div className="plist">
            {shown.map(s => (
              <div className="prow" key={s.member_id}>
                <span className="pname"><button className="linkbtn" onClick={() => setDetail(s.member_id)}>{s.name}</button>{s.member_id === meId && ' (toi)'}
                  <small>{[!s.active && 'ancien adhérent', s.since && `impayé depuis ${b.daysSince(s.since, now) === 0 ? 'aujourd\'hui' : f.plural(b.daysSince(s.since, now), 'jour')}`, s.pending > 0 && `${b.money(s.pending)} à valider`, s.reminder && (s.reminder.seen_at ? `rappel vu le ${f.shortDate(s.reminder.seen_at)}` : 'rappel pas encore vu')].filter(Boolean).join(', ') || 'À jour'}</small></span>
                <span className="acts">
                  {b.isLate(s, d.settings, now) && <span className="tag live barlate">En retard</span>}
                  <b className="tnum barcol">{s.due < 0 ? `+${b.money(-s.due)}` : b.money(s.due)}</b>
                  {s.open > 0 && s.member_id !== meId && <Ask s={s} d={d} busy={busy} remind={remind} />}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {open && <Detail s={open} d={d} reload={reload} remind={remind} onClose={() => setDetail(null)} />}
      {adjusting && <Adjust reload={reload} onClose={() => setAdjusting(false)} />}
    </div>
  );
}

function Ask({ s, d, busy, remind }: { s: Slate; d: BarData; busy: boolean; remind: (ids: string[]) => void }) {
  const toast = useToast();
  const unseen = s.reminder?.seen_at === null;
  return (
    <>
      <button className="iconbtn" title="Copier un message (WhatsApp, SMS)" aria-label={`Copier un message pour ${s.name}`} onClick={async () => {
        try { await navigator.clipboard.writeText(b.reminderText(s, d.settings)); toast('Message copié.'); } catch { toast('Copie impossible dans ce navigateur.', 'error'); }
      }}><Icon name="copy" size={16} /></button>
      {s.account && s.active
        ? <button className="btn sm" disabled={busy || unseen} title={unseen ? 'Le dernier rappel n\'a pas encore été vu' : undefined} aria-label={`Rappeler ${s.name}`} onClick={() => remind([s.member_id])}>{unseen ? 'Rappel envoyé' : 'Rappeler'}</button>
        : <span className="tag" title="Sans accès à l'application : envoie-lui le message">Sans compte</span>}
    </>
  );
}

function Detail({ s, d, reload, remind, onClose }: { s: Slate; d: BarData; reload: () => Promise<void>; remind: (ids: string[]) => void; onClose: () => void }) {
  const id = s.member_id, own = id === d.slate.member_id, now = Date.now();
  // Le solde change : le détail se relit.
  const q = useLoad(() => bar.detail(id), [id, s.taken, s.paid, s.pending]);
  const [paying, setPaying] = useState(false);
  const [run, busy] = useAction();
  const canCancel = (l: BarLine) => !l.cancelled_at && (l.item_id === null ? d.validate && !own : !own || b.canUndo(l, now));
  return (
    <Modal title={s.name} onClose={onClose} wide>
      <div className="stack">
        <div className="barstats">
          <div><span>Consommé</span><b>{b.money(s.taken)}</b></div>
          <div><span>Payé</span><b>{b.money(s.paid)}</b></div>
          <div><span>{s.due < 0 ? 'Avance' : 'Reste dû'}</span><b>{b.money(Math.abs(s.due))}</b></div>
        </div>
        <div className="row">
          {d.validate && !own && <button className="btn primary sm" onClick={() => setPaying(true)}>Encaisser</button>}
          {s.open > 0 && !own && <Ask s={s} d={d} busy={busy} remind={remind} />}
        </div>
        {!q.data ? <State loading={q.loading} error={q.error} onRetry={q.reload} /> : <>
          {q.data.payments.length > 0 && <div><h3 className="barh">Paiements</h3><div className="plist">{q.data.payments.map(p => <PayRow key={p.id} p={p} action={p.decided_by && <span className="muted">par {p.decided_by}</span>} />)}</div></div>}
          <div>
            <h3 className="barh">Consos</h3>
            {q.data.lines.length === 0 ? <p className="muted">Aucune.</p> : <div className="plist">{q.data.lines.map(l => <LineRow key={l.id} l={l} action={canCancel(l) && <button className="btn ghost sm" disabled={busy} onClick={() => run(async () => { await bar.undo(l.id); await reload(); await q.reload(); }, 'Annulé.')}>Annuler</button>} />)}</div>}
          </div>
        </>}
      </div>
      {paying && <PayModal title={`Encaisser ${s.name}`} ok="Encaisser" open={s.open} note="Paiement reçu en main propre : il est validé tout de suite." done="Paiement enregistré." onClose={() => setPaying(false)} onPay={async (amount, method) => { await bar.receive(id, amount, method); await reload(); }} />}
    </Modal>
  );
}

function Adjust({ reload, onClose }: { reload: () => Promise<void>; onClose: () => void }) {
  const m = useLoad(listMembers, []);
  const members = (m.data ?? []).filter(x => x.active);
  const [who, setWho] = useState('');
  const [kind, setKind] = useState<'add' | 'less'>('add');
  const [amount, setAmount] = useState<number | null>(null);
  const [label, setLabel] = useState('Reprise du tableau papier');
  const [run, busy] = useAction();
  return (
    <Modal title="Reprise ou correction" onClose={onClose}>
      <form className="stack" onSubmit={e => { e.preventDefault(); void run(async () => { await bar.adjust(who, b.cents(amount ?? 0) * (kind === 'add' ? 1 : -1), label); await reload(); }, 'Ardoise mise à jour.').then(x => { if (x) onClose(); }); }}>
        <Field label="Adhérent"><select value={who} required onChange={e => setWho(e.target.value)}><option value="">Choisir</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Choice label="Sens" value={kind} onChange={setKind} options={[{ value: 'add', label: 'Ajouter à son ardoise' }, { value: 'less', label: 'Retirer de son ardoise' }]} />
        <Field label="Montant (€)"><NumberInput value={amount} step={0.01} min={0} max={1000} onChange={setAmount} /></Field>
        <Field label="Motif"><input value={label} required maxLength={60} onChange={e => setLabel(e.target.value)} /></Field>
        <div className="row end"><button type="button" className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={busy || !who || !amount || !label.trim()}>Enregistrer</button></div>
      </form>
    </Modal>
  );
}

// ── Bilan ────────────────────────────────────────────────────────────────────

function Report({ slates }: { slates: Slate[] }) {
  const [period, setPeriod] = useState<'month' | 'season' | 'all'>('season');
  const now = new Date();
  const season = new Date(now.getFullYear() - (now.getMonth() < 8 ? 1 : 0), 8, 1).getTime();
  const from = period === 'month' ? now.getTime() - 30 * 86_400_000 : period === 'season' ? season : 0;
  const q = useLoad(() => bar.report(from), [period]);
  const rows = q.data ?? [];
  const sum = (k: 'count' | 'amount') => rows.reduce((n, x) => n + x[k], 0);
  return (
    <div className="stack">
      <div className="row">
        {([['month', '30 jours'], ['season', 'Saison'], ['all', 'Tout']] as const).map(([k, l]) => <button key={k} className={`toggle ${period === k ? 'on' : ''}`} aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
        <span className="spacer" />
        <button className="btn sm" onClick={() => {
          const url = URL.createObjectURL(new Blob([b.csv(slates)], { type: 'text/csv;charset=utf-8' }));
          const a = document.createElement('a');
          a.href = url; a.download = `buvette-${now.toISOString().slice(0, 10)}.csv`; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}><Icon name="download" size={15} />Exporter les ardoises</button>
      </div>
      <div className="card flush">
        {!q.data ? <div style={{ padding: 16 }}><State loading={q.loading} error={q.error} onRetry={q.reload} /></div> : rows.length === 0 ? <Empty title="Aucune conso sur cette période" /> : (
          <table className="table">
            <thead><tr><th>Produit</th><th className="num">Vendus</th><th className="num">Invités</th><th className="num">Montant</th></tr></thead>
            <tbody>
              {rows.map(r => <tr key={r.label}><td>{r.label}</td><td className="num">{f.num(r.count)}</td><td className="num">{r.guests || ''}</td><td className="num">{b.money(r.amount)}</td></tr>)}
              <tr><td><b>Total</b></td><td className="num"><b>{f.num(sum('count'))}</b></td><td /><td className="num total">{b.money(sum('amount'))}</td></tr>
            </tbody>
          </table>
        )}
      </div>
      <p className="muted">Compare les quantités vendues à ton stock : l'écart, ce sont les consos oubliées.</p>
    </div>
  );
}

// ── Tarifs et réglages ───────────────────────────────────────────────────────

function Prices({ d, isStaff, reload }: { d: BarData; isStaff: boolean; reload: () => Promise<void> }) {
  const [edit, setEdit] = useState<BarItem | 'new' | null>(null);
  const [set, setSet] = useState(d.settings);
  const [run, busy] = useAction();
  const url = `${location.origin}${location.pathname}${location.search}#/buvette`;
  return (
    <div className="two">
      <section className="card">
        <div className="sechead"><h2>Produits</h2><button className="btn sm" onClick={() => setEdit('new')}><Icon name="plus" size={15} />Ajouter</button></div>
        {d.items.length === 0 && <Empty title="Aucun produit">Ajoute ce que vous vendez, avec les prix du tableau papier.</Empty>}
        <div className="plist">
          {d.items.map((i, n) => (
            <div className={`prow ${i.active ? '' : 'out'}`} key={i.id}>
              <span className="baremoji sm" aria-hidden="true">{i.emoji || '•'}</span>
              <span className="pname">{i.name}{!i.active && <small>Plus proposé</small>}</span>
              <span className="acts">
                <b className="tnum">{b.money(i.price)}</b>
                <button className="iconbtn" disabled={busy || n === 0} aria-label={`Monter ${i.name}`} onClick={() => run(async () => { await bar.moveItem(i.id, -1); await reload(); })}><Icon name="up" size={15} /></button>
                <button className="iconbtn" disabled={busy || n === d.items.length - 1} aria-label={`Descendre ${i.name}`} onClick={() => run(async () => { await bar.moveItem(i.id, 1); await reload(); })}><Icon name="down" size={15} /></button>
                <button className="iconbtn" aria-label={`Modifier ${i.name}`} onClick={() => setEdit(i)}><Icon name="edit" size={15} /></button>
              </span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>Changer un prix ne modifie pas les consos déjà notées.</p>
      </section>
      <div className="stack">
        <form className="card stack" onSubmit={e => { e.preventDefault(); void run(async () => { await bar.saveSettings(set); await reload(); }, 'Réglages enregistrés.'); }}>
          <h2>Retards et paiement</h2>
          <Field label="Signaler une ardoise à partir de (€)"><NumberInput value={set.alert / 100} step={1} min={0} max={1000} onChange={x => setSet({ ...set, alert: b.cents(x ?? 0) })} /></Field>
          <Field label="Ou impayée depuis (jours)"><NumberInput value={set.days} step={1} min={1} max={365} onChange={x => setSet({ ...set, days: x ?? 30 })} /></Field>
          <Field label="Comment payer" hint="Affiché aux adhérents et dans les rappels"><textarea rows={2} maxLength={200} value={set.payInfo} onChange={e => setSet({ ...set, payInfo: e.target.value })} /></Field>
          <div className="row end"><button className="btn primary" disabled={busy}>Enregistrer</button></div>
        </form>
        <section className="card barqr">
          <div><h2>QR code pour le bar</h2><p className="muted">À imprimer : il ouvre la buvette sur le téléphone de l'adhérent.</p></div>
          <Qr text={url} size={132} />
        </section>
        {isStaff && <Kiosks />}
      </div>
      {edit && <EditItem item={edit === 'new' ? null : edit} reload={reload} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditItem({ item, reload, onClose }: { item: BarItem | null; reload: () => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [emoji, setEmoji] = useState(item?.emoji ?? '');
  const [price, setPrice] = useState<number | null>(item ? item.price / 100 : null);
  const [active, setActive] = useState(item?.active ?? true);
  const [run, busy] = useAction();
  return (
    <Modal title={item ? item.name : 'Nouveau produit'} onClose={onClose}>
      <form className="stack" onSubmit={e => { e.preventDefault(); void run(async () => { await bar.saveItem({ id: item?.id, name, emoji, price: b.cents(price ?? 0), active }); await reload(); }, 'Enregistré.').then(x => { if (x) onClose(); }); }}>
        <div className="form">
          <Field label="Nom"><input value={name} required maxLength={30} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Prix (€)"><NumberInput value={price} step={0.01} min={0} max={100} onChange={setPrice} /></Field>
          <Field label="Symbole" hint="Un émoji, facultatif"><input value={emoji} maxLength={8} onChange={e => setEmoji(e.target.value)} /></Field>
        </div>
        <Switch label="Proposé à la buvette" checked={active} onChange={setActive} />
        <div className="row end"><button type="button" className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={busy || !name.trim() || price === null}>Enregistrer</button></div>
      </form>
    </Modal>
  );
}

// ── Tablettes du comptoir ────────────────────────────────────────────────────

function Kiosks() {
  const q = useLoad(() => bar.kiosks(), []);
  const [name, setName] = useState('');
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <section className="card">
      <h2>Tablettes du comptoir</h2>
      <p className="muted">Une tablette n'a pas de compte : elle ouvre un lien, note les consos, et ne voit ni les soldes ni les paiements.</p>
      {!q.data ? <State loading={q.loading} error={q.error} onRetry={q.reload} /> : (
        <div className="plist" style={{ marginTop: 8 }}>
          {q.data.map((k: Kiosk) => (
            <div className="prow" key={k.id}>
              <span className="pname">{k.name}<small>{k.used_at ? `utilisée le ${when(k.used_at)}` : 'jamais utilisée'}</small></span>
              <button className="btn ghost sm" disabled={busy} onClick={async () => {
                if (await confirm({ title: `Retirer ${k.name} ?`, text: 'Son lien ne marchera plus. Les consos déjà notées restent.', ok: 'Retirer', danger: true })) void run(async () => { await bar.revokeKiosk(k.id); await q.reload(); }, 'Accès retiré.');
              }}>Retirer</button>
            </div>
          ))}
        </div>
      )}
      <form className="row" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); void run(async () => { const k = await bar.createKiosk(name); setLink({ name: name.trim(), url: kioskLink(k) }); setName(''); await q.reload(); }); }}>
        <input style={{ maxWidth: 220 }} placeholder="Tablette du bar" aria-label="Nom de la tablette" maxLength={40} value={name} onChange={e => setName(e.target.value)} />
        <button className="btn" disabled={busy || !name.trim()}>Créer un accès</button>
      </form>
      {link && (
        <Modal title={link.name} onClose={() => setLink(null)}>
          <div className="stack">
            <p>Sur la tablette, scanne ce QR code ou ouvre ce lien. <b>Il n'est montré qu'une fois</b> : garde-le pour toi, il permet de noter des consos pour tout le monde.</p>
            <div style={{ display: 'grid', justifyItems: 'center' }}><Qr text={link.url} size={200} /></div>
            <div className="row end">
              {isDemo && <span className="muted" style={{ marginRight: 'auto' }}>Démo : choisis plutôt « tablette du comptoir » en haut.</span>}
              <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(link.url); toast('Lien copié.'); } catch { toast('Copie impossible dans ce navigateur.', 'error'); } }}><Icon name="copy" />Copier le lien</button>
              <button className="btn primary" onClick={() => setLink(null)}>C'est fait</button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
