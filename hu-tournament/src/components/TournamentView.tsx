import {
  type Tournament, currentRound, roundComplete, finished, champion, eliminated, standings,
  setWinner, nextRound, addRound, cancelLastRound, redrawCurrentRound, roundLabel, FORMAT_LABEL,
} from '../lib/tournament';

interface Props {
  t: Tournament;
  onChange: (t: Tournament) => void;
  onBack: () => void;
  onDelete: () => void;
}

export function TournamentView({ t, onChange, onBack, onDelete }: Props) {
  const nameOf = (id: string) => t.players.find(p => p.id === id)?.name ?? '?';
  const swiss = t.format === 'swiss';
  const round = currentRound(t)!;
  const complete = roundComplete(round);
  const over = finished(t);
  const champ = champion(t);
  const alive = round.matches.length * 2 + (round.bye ? 1 : 0);
  const label = roundLabel(t, alive);
  const hasResult = round.matches.some(m => m.winner !== null);
  const outSet = new Set(eliminated(t).map(e => e.id));
  const table = swiss ? standings(t) : null;
  const canDrawNext = complete && !over;

  function pick(matchId: string, playerId: string, current: string | null) {
    onChange(setWinner(t, matchId, current === playerId ? null : playerId));
  }

  const medal = (rank: number) => (over && rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `${rank}.`);

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn sm" onClick={onBack}>← Tournois</button>
        <span className="muted">{FORMAT_LABEL[t.format]} · {t.players.length} joueurs · {new Date(t.createdAt).toLocaleDateString('fr-FR')}</span>
      </div>

      {champ && (
        <div className="card champion">
          <div className="trophy">🏆</div>
          <div className="muted">Vainqueur</div>
          <div className="name">{nameOf(champ)}</div>
          <div className="muted">{t.rounds.length} tour{t.rounds.length > 1 ? 's' : ''}</div>
        </div>
      )}

      <div className="card">
        <div className="round-head">
          <h2>Tour {round.n}</h2>
          {label && <span className="muted">{label}</span>}
          <span className="muted" style={{ marginLeft: 'auto' }}>{alive} joueurs</span>
        </div>

        {round.bye && (
          <div className="bye">Exempté ce tour : <b>{nameOf(round.bye)}</b>{swiss && <span className="muted"> (victoire)</span>}</div>
        )}

        {round.matches.map(m => {
          const btn = (pid: string) => {
            const cls = ['pbtn', m.winner === pid ? 'win' : '', m.winner && m.winner !== pid ? 'lose' : '', over ? 'locked' : ''].join(' ');
            return (
              <button className={cls} disabled={over} onClick={() => pick(m.id, pid, m.winner)}>
                {nameOf(pid)}
              </button>
            );
          };
          return (
            <div className="match" key={m.id}>
              {btn(m.a)}
              <span className="vs">VS</span>
              {btn(m.b)}
            </div>
          );
        })}

        <div style={{ marginTop: 14 }}>
          {canDrawNext && (
            <button className="btn primary block" onClick={() => onChange(nextRound(t))}>
              🎲 Tirer le tour {round.n + 1}{swiss ? '' : ` (${alive - round.matches.length} joueurs)`}
            </button>
          )}
          {!complete && (
            <p className="muted" style={{ textAlign: 'center' }}>Touche le gagnant de chaque HU pour pouvoir tirer le tour suivant.</p>
          )}
          {over && swiss && (
            <button className="btn block" onClick={() => onChange(addRound(t))}>
              + Ajouter un tour {t.rounds.length + 1}
            </button>
          )}
          <div className="row" style={{ marginTop: 10, justifyContent: 'center' }}>
            {!over && (
              <button className="btn sm" disabled={hasResult} onClick={() => onChange(redrawCurrentRound(t))}>↻ Retirer ce tour au sort</button>
            )}
            {t.rounds.length > 1 && (
              <button className="btn sm" onClick={() => { if (confirm(`Annuler le tour ${round.n} et revenir au tour ${round.n - 1} ?`)) onChange(cancelLastRound(t)); }}>
                ↩ Annuler ce tour
              </button>
            )}
          </div>
        </div>
      </div>

      {table && (
        <div className="card">
          <h2>Classement{over ? ' final' : ''}</h2>
          <table className="stand">
            <thead>
              <tr><th></th><th style={{ textAlign: 'left' }}>Joueur</th><th>V</th><th>D</th><th title="Buchholz : somme des victoires des adversaires rencontrés">Buch.</th></tr>
            </thead>
            <tbody>
              {table.map(s => (
                <tr key={s.id} className={s.rank === 1 && over ? 'first' : ''}>
                  <td className="rank">{medal(s.rank)}</td>
                  <td style={{ textAlign: 'left', fontWeight: 700 }}>{nameOf(s.id)}</td>
                  <td>{s.wins}</td>
                  <td>{s.losses}</td>
                  <td className="muted">{s.buchholz}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 8 }}>Départage : victoires, puis Buchholz (force des adversaires), puis confrontation directe.</p>
        </div>
      )}

      {t.rounds.length > 1 && (
        <div className="card">
          <details>
            <summary>Tours précédents</summary>
            {t.rounds.slice(0, -1).reverse().map(r => (
              <div className="hist" key={r.n}>
                <div className="muted" style={{ fontWeight: 700, marginBottom: 4 }}>Tour {r.n}</div>
                {r.bye && <div className="line"><span>Exempté : {nameOf(r.bye)}</span></div>}
                {r.matches.map(m => (
                  <div className="line" key={m.id}>
                    <span className="w">{nameOf(m.winner!)}</span>
                    <span className="muted">bat</span>
                    <span className="l">{nameOf(m.winner === m.a ? m.b : m.a)}</span>
                  </div>
                ))}
              </div>
            ))}
          </details>
        </div>
      )}

      {!swiss && (
        <div className="card">
          <h2>Joueurs</h2>
          <div className="chips">
            {t.players.map(p => <span key={p.id} className={`chip${outSet.has(p.id) ? ' out' : ''}`}>{p.name}</span>)}
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn danger sm" onClick={() => { if (confirm(`Supprimer « ${t.name} » ?`)) onDelete(); }}>Supprimer le tournoi</button>
      </div>
    </>
  );
}
