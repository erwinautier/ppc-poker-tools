import { useClub } from '../../lib/club';
import { distinctPrizes, durationField, isSng, participants, prizeGroups } from '../../lib/engine';
import { estimateMinutes } from '../../lib/structure';
import * as f from '../../lib/format';
import type { TabProps } from '../../pages/Tournament';
import { ChipDot } from '../ui';
import { suggestedRounds } from '../../lib/hu';
import { HU_SYSTEM_LABEL } from '../../lib/types';
import { PrizeLists } from './Live';

export function bountyText(s: TabProps['b']['t']['settings']): string {
  const { mode, unit, amount } = s.bounty;
  if (mode === 'none') return 'Aucune';
  const value = unit === 'pts' ? f.plural(amount, 'point') : unit === 'eur' ? f.eur(amount) : amount > 0 ? f.plural(amount, 'lot') : 'sur certains joueurs';
  return mode === 'progressive' ? `Progressives, ${value} au départ` : `${value} par élimination`;
}

export function Infos({ b }: TabProps) {
  const { t, entries } = b;
  const { me } = useClub();
  const s = t.settings;
  const registered = entries.filter(e => e.status === 'registered');
  const waiting = entries.filter(e => e.status === 'waitlist');
  const inPlay = participants(t, entries);
  const field = inPlay.length || registered.length;
  const sng = isSng(t.settings);
  const players = durationField(t, Math.max(2, field || t.max_players || 16));
  const est = estimateMinutes(t.levels, players, t.starting_stack);
  const prizes = distinctPrizes(prizeGroups(t, inPlay.length ? inPlay : registered));
  const final = t.settings.finalTable || t.seats_per_table;
  const hu = s.format === 'hu';
  const huText = `Heads-up, ${HU_SYSTEM_LABEL[s.hu.system].toLowerCase()}${s.hu.system === 'swiss' ? ` en ${f.plural(s.hu.rounds || suggestedRounds(Math.max(2, field || t.max_players || 16)), 'tour', 'tours')}` : ''}`;
  const cost = s.buyIn + s.fee + (s.bounty.mode !== 'none' && s.bounty.unit === 'eur' ? s.bounty.amount : 0);
  const first = t.levels.find(l => l.kind === 'level');

  return (
    <div className="two">
      <div className="stack">
        {t.description && <div className="card" style={{ whiteSpace: 'pre-wrap' }}>{t.description}</div>}
        <div className="card">
          <h2>Format</h2>
          <dl className="deflist">
            <div><dt>Tapis de départ</dt><dd>{f.num(t.starting_stack)} jetons{first ? ` (${f.num(Math.round(t.starting_stack / first.bb))} BB)` : ''}</dd></div>
            {t.structure_name && <div><dt>Structure</dt><dd>{t.structure_name}</dd></div>}
            <div><dt>Déroulé</dt><dd>{hu ? huText : sng ? 'Sit\'N Go : chacun garde sa table jusqu\'à son élimination, un classement par table' : `MTT : tables rééquilibrées, table finale à ${final} joueurs`}</dd></div>
            {est && !hu && <div><dt>Durée probable</dt><dd>{f.duration(est)}{field ? ` à ${players} joueurs${sng ? ' par table' : ''}` : ''}</dd></div>}
            {!hu && <div><dt>Tables</dt><dd>{t.seats_per_table} joueurs au plus</dd></div>}
            {!hu && <div><dt>Arrivée tardive</dt><dd>{s.lateRegLevel > 0 ? `jusqu'à la fin du niveau ${s.lateRegLevel}` : 'non'}</dd></div>}
            {!hu && <div><dt>Recaves</dt><dd>{s.rebuy.enabled ? `${s.rebuy.max === 0 ? 'illimitées' : f.plural(s.rebuy.max, 'recave')} jusqu'au niveau ${s.rebuy.untilLevel}, ${f.num(s.rebuy.stack || t.starting_stack)} jetons${s.rebuy.price > 0 ? `, ${f.eur(s.rebuy.price)}` : ''}` : 'non'}</dd></div>}
            {!hu && s.addon.enabled && <div><dt>Add-on</dt><dd>{f.num(s.addon.stack)} jetons{s.addon.price > 0 ? `, ${f.eur(s.addon.price)}` : ''}</dd></div>}
            {!hu && <div><dt>Primes</dt><dd>{bountyText(s)}</dd></div>}
            {cost > 0 && <div><dt>Participation</dt><dd>{f.eur(cost)}</dd></div>}
          </dl>
        </div>
        {prizes.length > 0 && (
          <div className="card">
            <h2>Dotation{sng && prizes.length === 1 ? ' par table' : ''}{t.status !== 'finished' && s.payouts.mode !== 'lots' ? ' (selon les inscriptions)' : ''}</h2>
            <PrizeLists groups={prizes} />
          </div>
        )}
        {t.chips.length > 0 && (
          <div className="card">
            <h2>Jetons distribués</h2>
            <div className="row" style={{ gap: 14 }}>
              {t.chips.map((c, i) => <span key={i} className="row tnum" style={{ gap: 6, fontWeight: 600 }}><ChipDot color={c.color} />{f.num(c.value)}{c.count > 0 && <span className="muted">x {c.count}</span>}</span>)}
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <h2>{t.max_players ? `Inscriptions : ${registered.length} / ${t.max_players}` : f.plural(registered.length, 'inscription')}</h2>
        {registered.length === 0 ? <p className="muted">Personne pour l'instant.</p> : (
          <div className="plist">
            {registered.map((e, i) => (
              <div className="prow" key={e.id}>
                <span className="idx">{i + 1}</span>
                <span className="pname">{e.member_id && me ? <a href={`#/j/${e.member_id}`}>{e.name}</a> : e.name}</span>
                {e.member_id === me?.id && me && <span className="tag open">Toi</span>}
              </div>
            ))}
          </div>
        )}
        {waiting.length > 0 && (
          <>
            <h2 style={{ margin: '18px 0 8px', fontSize: '.92rem' }}>Liste d'attente</h2>
            <div className="plist">{waiting.map((e, i) => <div className="prow out" key={e.id}><span className="idx">{i + 1}</span><span className="pname">{e.name}</span></div>)}</div>
          </>
        )}
      </div>
    </div>
  );
}
