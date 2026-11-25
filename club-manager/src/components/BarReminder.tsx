/** Le rappel envoyé par l'équipe : s'affiche dès que l'application est ouverte. */
import { bar } from '../lib/club';
import { useBar } from '../lib/barContext';
import { go } from '../lib/router';
import * as b from '../lib/bar';
import { Modal } from './ui';

export function BarReminder() {
  const { data: d, reload } = useBar();
  if (!d || d.slate.reminder?.seen_at !== null || d.slate.open <= 0) return null;
  const s = d.slate;
  const close = async (to?: string) => {
    if (to) go(to);
    try { await bar.seen(); } catch { /* hors ligne : il reviendra */ }
    await reload();
  };
  return (
    <Modal title="Petit rappel de la buvette" small onClose={() => void close()}>
      <div className="stack">
        <p>Ton ardoise est de <b>{b.money(s.open)}</b>{s.since && `, dont une partie depuis le ${new Date(s.since).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}.</p>
        {d.settings.payInfo && <p className="muted">{d.settings.payInfo}</p>}
        <div className="row end">
          <button className="btn" onClick={() => void close()}>Plus tard</button>
          <button className="btn" onClick={() => void close('/buvette')}>Voir mon ardoise</button>
          <button className="btn primary" onClick={() => void close('/buvette?payer')}>J'ai payé</button>
        </div>
      </div>
    </Modal>
  );
}
