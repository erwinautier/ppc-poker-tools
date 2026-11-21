import { useState } from 'react';
import {
  type Tournament, currentRound, roundComplete, finished, champion, eliminated, standings, encounters,
  needsPlayoff, startPlayoff, playoffRound, setWinner, nextRound, addRound, cancelLastRound,
  redrawCurrentRound, roundLabel, fmtPoints, byeValue, FORMAT_LABEL,
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
  const label = roundLabel(t, round, alive);
  const hasResult = round.matches.some(m => m.winner !== null);
  const outSet = new Set(eliminated(t).map(e => e.id));
  const table = swiss ? standings(t) : null;
  const playoff = playoffRound(t);
  const canDrawNext = complete && !over && !round.playoff;
  const [openRow, setOpenRow] = useState<string | null>(null);

  function pick(matchId: string, playerId: string, current: string | null) {
    onChange(setWinner(t, matchId, current === playerId ? null : playerId));
  }

  const medal = (rank: number) => (over && rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `${rank}.`);
  const history = t.rounds.filter(r => r !== round || roundComplete(r)).reverse();

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
          <div className="muted">{t.rounds.length} tour{t.rounds.length > 1 ? 's' : ''}{playoff ? ' dont un barrage' : ''}</div>
        </div>
      )}

      <div className="card">
        <div className="round-head">
          <h2>{round.playoff ? '⚔️ Barrage' : `Tour ${round.n}`}</h2>
          {label && <span className="muted">{label}</span>}
          {!round.playoff && <span className="muted" style={{ marginLeft: 'auto' }}>{alive} joueurs</span>}
        </div>

        {round.bye && (
          <div className="bye">
            Exempté ce tour : <b>{nameOf(round.bye)}</b>
            {swiss && <span className="muted"> ({fmtPoints(byeValue(t))} point)</span>}
          </div>
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
            <p className="muted" style={{ textAlign: 'center' }}>
              {round.playoff ? 'Touche le vainqueur du barrage.' : 'Touche le gagnant de chaque HU pour pouvoir tirer le tour suivant.'}
            </p>
          )}
          {needsPlayoff(t) && (
            <div className="playoff-box">
              <b>{nameOf(standings(t)[0].id)}</b> et <b>{nameOf(standings(t)[1].id)}</b> sont à égalité parfaite pour la 1re place.
              <button className="btn primary block" style={{ marginTop: 8 }} onClick={() => onChange(startPlayoff(t))}>
                ⚔️ Jouer un HU de barrage
              </button>
            </div>
          )}
          {over && swiss && !playoff && (
            <button className="btn block" style={{ marginTop: 8 }} onClick={() => onChange(addRound(t))}>
              + Ajouter un tour {t.rounds.length + 1}
            </button>
          )}
          <div className="row" style={{ marginTop: 10, justifyContent: 'center' }}>
            {!over && !round.playoff && (
              <button className="btn sm" disabled={hasResult} onClick={() => onChange(redrawCurrentRound(t))}>↻ Retirer ce tour au sort</button>
            )}
            {t.rounds.length > 1 && (
              <button className="btn sm" onClick={() => { if (confirm(`Annuler ${round.playoff ? 'le barrage' : `le tour ${round.n}`} ?`)) onChange(cancelLastRound(t)); }}>
                ↩ Annuler {round.playoff ? 'le barrage' : 'ce tour'}
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
              <tr>
                <th></th><th style={{ textAlign: 'left' }}>Joueur</th>
                <th title="Points : 1 par victoire, ½ par exemption">Pts</th>
                <th title="Victoires">V</th><th title="Défaites">D</th>
                <th title="Buchholz : somme des points des adversaires rencontrés">Buch.</th>
                <th title="Sonneborn-Berger : somme des points des adversaires battus">SB</th>
              </tr>
            </thead>
            <tbody>
              {table.map(s => {
                const isOpen = openRow === s.id;
                return [
                  <tr key={s.id} className={`${s.rank === 1 && over ? 'first' : ''} clickable`} onClick={() => setOpenRow(isOpen ? null : s.id)}>
                    <td className="rank">{medal(s.rank)}</td>
                    <td style={{ textAlign: 'left', fontWeight: 700 }}>{nameOf(s.id)} <span className="muted">{isOpen ? '▾' : '▸'}</span></td>
                    <td style={{ fontWeight: 700 }}>{fmtPoints(s.points)}</td>
                    <td>{s.wins}</td>
                    <td>{s.losses}</td>
                    <td className="muted">{fmtPoints(s.buchholz)}</td>
                    <td className="muted">{fmtPoints(s.sb)}</td>
                  </tr>,
                  isOpen && (
                    <tr key={s.id + '-d'} className="detail">
                      <td colSpan={7}>
                        {encounters(t, s.id).map(e => (
                          <div className="enc" key={e.round}>
                            <span className="muted">T{e.round}</span>
                            {e.opponent === null ? (
                              <>
                                <span>Exempté <span className="muted">(+{fmtPoints(byeValue(t))} pt)</span></span>
                                <span className="muted" style={{ marginLeft: 'auto' }}>
                                  {t.rules >= 2 ? `adversaire virtuel : ${fmtPoints(e.counted)}` : 'non compté'}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className={e.result === 'W' ? 'w' : e.result === 'L' ? 'l' : ''}>
                                  {e.result === 'W' ? 'bat' : e.result === 'L' ? 'perd contre' : 'joue'} {nameOf(e.opponent)}
                                </span>
                                <span className="muted" style={{ marginLeft: 'auto' }}>{fmtPoints(e.counted)} pt{e.counted >= 2 ? 's' : ''}</span>
                              </>
                            )}
                          </div>
                        ))}
                        <div className="enc total">
                          <span>Buchholz = {encounters(t, s.id).map(e => fmtPoints(e.counted)).join(' + ')} = <b>{fmtPoints(s.buchholz)}</b></span>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 8 }}>
            Départage : points, Buchholz, barrage ou confrontation directe, puis Sonneborn-Berger.
            {t.rules >= 2
              ? ' Exemption = ½ point, comptée comme un nul contre un adversaire de même niveau.'
              : ' Exemption = 1 point (anciennes règles).'}
            {' '}Touche un joueur pour voir le détail.
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <details>
            <summary>Historique des tours ({history.length})</summary>
            {history.map(r => (
              <div className="hist" key={r.n}>
                <div className="muted" style={{ fontWeight: 700, marginBottom: 4 }}>{r.playoff ? 'Barrage' : `Tour ${r.n}`}</div>
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
