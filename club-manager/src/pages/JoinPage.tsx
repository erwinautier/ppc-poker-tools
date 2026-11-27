/** « Modifier la page Rejoindre le club » : les questions fréquentes de la page publique (administrateurs). */
import { useRef, useState } from 'react';
import { api, useLoad } from '../lib/club';
import { NotInstalled } from '../lib/api';
import { DEFAULT_FAQ, FAQ_LIMITS, cleanFaq, type FaqItem, type JoinPageRow } from '../lib/joinPage';
import { Empty, Field, Icon, State, useAction, useConfirm } from '../components/ui';

interface Loaded { faq: FaqItem[]; saved: boolean; installed: boolean; updatedAt: string | null }

export function JoinPageEdit() {
  const q = useLoad(async (): Promise<Loaded> => {
    try {
      const [row] = await api.select<JoinPageRow>('club_join_page');
      return row
        ? { faq: row.faq, saved: true, installed: true, updatedAt: row.updated_at }
        : { faq: DEFAULT_FAQ, saved: false, installed: true, updatedAt: null };
    } catch (e) {
      // Script 006 pas encore exécuté : on montre les questions par défaut, sans enregistrer.
      if (e instanceof NotInstalled) return { faq: DEFAULT_FAQ, saved: false, installed: false, updatedAt: null };
      throw e;
    }
  }, []);
  if (!q.data) return <State loading={q.loading} error={q.error} onRetry={q.reload} />;
  return <Form key={q.data.updatedAt ?? 'defaut'} initial={q.data} reload={q.reload} />;
}

type Row = FaqItem & { k: number };

function Form({ initial, reload }: { initial: Loaded; reload: () => Promise<void> }) {
  const next = useRef(0);
  const toRows = (list: FaqItem[]): Row[] => list.map(({ q, a }) => ({ q, a, k: next.current++ }));
  const [rows, setRows] = useState<Row[]>(() => toRows(initial.faq));
  const [run, busy] = useAction();
  const confirm = useConfirm();

  const plain = (list: FaqItem[]) => JSON.stringify(list.map(({ q, a }) => ({ q, a })));
  const dirty = plain(rows) !== plain(initial.faq);
  const set = (k: number, p: Partial<FaqItem>) => setRows(l => l.map(r => r.k === k ? { ...r, ...p } : r));
  const move = (i: number, d: -1 | 1) => setRows(l => {
    const n = [...l];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    return n;
  });

  async function save() {
    if (rows.length === 0 && !(await confirm({ title: 'Enregistrer sans aucune question ?', text: 'La section « Questions fréquentes » n\'apparaîtra plus sur la page.', ok: 'Enregistrer' }))) return;
    await run(async () => {
      await api.rpc('club_save_join_faq', { p_faq: cleanFaq(rows) });
      await reload();
    }, 'Page enregistrée.');
  }

  async function restore() {
    if (await confirm({ title: 'Reprendre les questions d\'origine ?', text: 'Les questions ci-dessous seront remplacées. Rien ne change sur la page tant que tu n\'as pas enregistré.', ok: 'Reprendre' })) {
      setRows(toRows(DEFAULT_FAQ));
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <div className="pagehead">
        <div>
          <h1>Page « Rejoindre le club »</h1>
          <p>Les questions fréquentes de la page publique. Seuls les administrateurs peuvent les modifier.</p>
        </div>
        <a className="btn" href="/rejoindre/" target="_blank" rel="noopener"><Icon name="share" size={16} />Voir la page</a>
      </div>

      <div className="stack" style={{ maxWidth: 820 }}>
        {!initial.installed && (
          <div className="card warn"><p className="muted">
            Pour enregistrer des questions, exécute <code>club-manager/supabase/006_club_join_page.sql</code> dans Supabase (SETUP.md).
            En attendant, la page affiche les questions ci-dessous.
          </p></div>
        )}
        {initial.installed && !initial.saved && <p className="muted">La page affiche pour l'instant les questions d'origine ci-dessous.</p>}

        {rows.map((r, i) => (
          <div className="card" key={r.k}>
            <div className="row between">
              <h2>Question {i + 1}</h2>
              <div className="row">
                <button type="button" className="iconbtn" disabled={i === 0} onClick={() => move(i, -1)} title="Monter" aria-label={`Monter la question ${i + 1}`}><Icon name="up" size={16} /></button>
                <button type="button" className="iconbtn" disabled={i === rows.length - 1} onClick={() => move(i, 1)} title="Descendre" aria-label={`Descendre la question ${i + 1}`}><Icon name="down" size={16} /></button>
                <button type="button" className="iconbtn" onClick={() => setRows(l => l.filter(x => x.k !== r.k))} title="Supprimer" aria-label={`Supprimer la question ${i + 1}`}><Icon name="trash" size={16} /></button>
              </div>
            </div>
            <div className="form">
              <Field label="Question" wide>
                <input maxLength={FAQ_LIMITS.q} value={r.q} placeholder="Votre question" onChange={e => set(r.k, { q: e.target.value })} />
              </Field>
              <Field label="Réponse" wide hint={`${r.a.length} / ${FAQ_LIMITS.a} caractères ; un retour à la ligne est gardé tel quel`}>
                <textarea rows={3} maxLength={FAQ_LIMITS.a} value={r.a} onChange={e => set(r.k, { a: e.target.value })} />
              </Field>
            </div>
          </div>
        ))}
        {rows.length === 0 && <Empty title="Aucune question">Enregistrée ainsi, la page n'affiche plus de questions fréquentes.</Empty>}

        <div>
          <button type="button" className="btn" disabled={rows.length >= FAQ_LIMITS.items} onClick={() => setRows(l => [...l, ...toRows([{ q: '', a: '' }])])}>
            <Icon name="plus" size={16} />Ajouter une question
          </button>
        </div>

        <div className="row between">
          <button type="button" className="btn" disabled={busy} onClick={() => void restore()}><Icon name="undo" size={16} />Questions d'origine</button>
          <div className="row">
            <button type="button" className="btn" disabled={busy || !dirty} onClick={() => setRows(toRows(initial.faq))}>Annuler les changements</button>
            <button className="btn primary" disabled={busy || !dirty || !initial.installed}>Enregistrer</button>
          </div>
        </div>
      </div>
    </form>
  );
}
