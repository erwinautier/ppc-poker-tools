import {
  type Tournament, currentRound, roundComplete, survivors, champion, eliminated,
  setWinner, nextRound, cancelLastRound, redrawCurrentRound, roundLabel,
} from '../lib/tournament';

interface Props {
  t: Tournament;
  onChange: (t: Tournament) => void;
  onBack: () => void;
  onDelete: () => void;
}

export function TournamentView({ t, onChange, onBack, onDelete }: Props) {
  const nameOf = (id: string) => t.players.find(p => p.id === id)?.name ?? '?';
  const round = currentRound(t)!;
  const complete = roundComplete(round);
  const champ = champion(t);
  const alive = round.matches.length * 2 + (round.bye ? 1 : 0);
  const label = roundLabel(alive);
  const hasResult = round.matches.some(m => m.winner !== null);
  const outSet = new Set(eliminated(t).map(e => e.id));
  const nextCount = complete ? survivors(round).length : 0;

  function pick(matchId: string, playerId: string, current: string | null) {
    onChange(setWinner(t, matchId, current === playerId ? null : playerId));
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn sm" onClick={onBack}>← Tournois</button>
        <span className="muted">{t.players.length} joueurs · {new Date(t.createdAt).toLocaleDateString('fr-FR')}</span>
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
          <div className="bye">Exempté ce tour : <b>{nameOf(round.bye)}</b></div>
        )}

        {round.matches.map(m => {
          const btn = (pid: string) => {
            const cls = ['pbtn', m.winner === pid ? 'win' : '', m.winner && m.winner !== pid ? 'lose' : '', champ ? 'locked' : ''].join(' ');
            return (
              <button className={cls} disabled={!!champ} onClick={() => pick(m.id, pid, m.winner)}>
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

        {!champ && (
          <div style={{ marginTop: 14 }}>
            {complete ? (
              <button className="btn primary block" onClick={() => onChange(nextRound(t))}>
                🎲 Tirer le tour {round.n + 1} ({nextCount} joueurs)
              </button>
            ) : (
              <p className="muted" style={{ textAlign: 'center' }}>Touche le gagnant de chaque HU pour pouvoir tirer le tour suivant.</p>
            )}
            <div className="row" style={{ marginTop: 10, justifyContent: 'center' }}>
              <button className="btn sm" disabled={hasResult} onClick={() => onChange(redrawCurrentRound(t))}>↻ Retirer ce tour au sort</button>
              {t.rounds.length > 1 && (
                <button className="btn sm" onClick={() => { if (confirm(`Annuler le tour ${round.n} et revenir au tour ${round.n - 1} ?`)) onChange(cancelLastRound(t)); }}>
                  ↩ Annuler ce tour
                </button>
              )}
            </div>
          </div>
        )}
      </div>

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

      <div className="card">
        <h2>Joueurs</h2>
        <div className="chips">
          {t.players.map(p => <span key={p.id} className={`chip${outSet.has(p.id) ? ' out' : ''}`}>{p.name}</span>)}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn danger sm" onClick={() => { if (confirm(`Supprimer « ${t.name} » ?`)) onDelete(); }}>Supprimer le tournoi</button>
      </div>
    </>
  );
}
