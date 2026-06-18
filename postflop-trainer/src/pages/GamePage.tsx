import { useState, useEffect, useCallback } from 'react';
import type { GameState, ActionType, StreetAction, Street } from '../types';
import { getNextActor, nextStreet, streetLabel, actionLabel } from '../lib/game';
import { dealCards } from '../lib/cards';
import {
  callClaudeAfterHeroAction, callClaudeVillainFirst,
  callClaudeHandReview, AI_LABEL,
} from '../lib/claudeApi';
import ActionButtons from '../components/ActionButtons';
import CommentBox from '../components/CommentBox';
import PostflopTable from '../components/PostflopTable';
import type { Card } from '../types';

interface GamePageProps {
  game: GameState;
  apiKey: string;
  onNewHand: () => void;
}

function applyChips(
  pot: number, heroStack: number, villainStack: number,
  action: StreetAction,
): { pot: number; heroStack: number; villainStack: number } {
  const { type, amount, player } = action;
  if ((type === 'bet' || type === 'raise' || type === 'call' || type === 'all_in') && amount) {
    return {
      pot: pot + amount,
      heroStack: player === 'hero' ? heroStack - amount : heroStack,
      villainStack: player === 'villain' ? villainStack - amount : villainStack,
    };
  }
  return { pot, heroStack, villainStack };
}

export default function GamePage({ game: initialGame, apiKey, onNewHand }: GamePageProps) {
  const [game, setGame] = useState<GameState>({ ...initialGame, handReview: null });

  useEffect(() => {
    if (game.phase === 'villain_turn') {
      triggerVillainFirst(game);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Automatically fetch hand review and reveal villain's hand ─────────────
  const triggerHandOver = useCallback(async (g: GameState) => {
    setGame(prev => ({ ...prev, phase: 'reviewing', error: null }));
    try {
      const review = await callClaudeHandReview({
        apiKey,
        heroHand: g.heroHand, heroHandType: g.heroHandType,
        heroIsIP: g.heroIsIP, heroRange: g.heroRange, villainRange: g.villainRange,
        villainPickedHand: g.villainPickedHand, villainPickedHandType: g.villainPickedHandType,
        board: g.board as Card[],
        allHandActions: g.allActions,
      });
      setGame(prev => ({ ...prev, phase: 'hand_over', handReview: review, error: null }));
    } catch (err) {
      setGame(prev => ({
        ...prev, phase: 'hand_over', handReview: null,
        error: err instanceof Error ? err.message : 'Erreur lors de la review',
      }));
    }
  }, [apiKey]);

  const triggerVillainFirst = useCallback(async (g: GameState) => {
    setGame(prev => ({ ...prev, phase: 'loading', error: null }));
    try {
      const resp = await callClaudeVillainFirst({
        apiKey,
        heroHand: g.heroHand, heroHandType: g.heroHandType,
        heroIsIP: g.heroIsIP, heroRange: g.heroRange, villainRange: g.villainRange,
        villainPickedHand: g.villainPickedHand, villainPickedHandType: g.villainPickedHandType,
        board: g.board as Card[], street: g.street,
        pot: g.pot, heroStack: g.heroStack, villainStack: g.villainStack,
        allHandActions: g.allActions,
      });

      const villainAction: StreetAction = { player: 'villain', type: resp.villain.action, amount: resp.villain.amount };
      const chips = applyChips(g.pot, g.heroStack, g.villainStack, villainAction);
      const newStreetActions = [...g.streetActions, villainAction];

      setGame(prev => ({
        ...prev,
        streetActions: newStreetActions,
        allActions: [...prev.allActions, villainAction],
        pot: chips.pot, heroStack: chips.heroStack, villainStack: chips.villainStack,
        phase: 'hero_turn',
        lastVillainAction: resp.villain,
        lastComment: null, error: null,
      }));
    } catch (err) {
      setGame(prev => ({
        ...prev, phase: 'hero_turn',
        error: err instanceof Error ? err.message : 'Erreur API',
      }));
    }
  }, [apiKey]);

  const handleHeroAction = useCallback(async (type: ActionType, amount?: number) => {
    const heroAction: StreetAction = { player: 'hero', type, amount };
    const priorStreetActions = [...game.streetActions];
    const newStreetActions = [...game.streetActions, heroAction];
    const afterHero = applyChips(game.pot, game.heroStack, game.villainStack, heroAction);

    const nextAfterHero = getNextActor(newStreetActions, game.heroIsIP);
    const villainMustAct = nextAfterHero.who === 'villain';

    setGame(prev => ({ ...prev, phase: 'loading', error: null }));

    try {
      const resp = await callClaudeAfterHeroAction({
        apiKey,
        heroHand: game.heroHand, heroHandType: game.heroHandType,
        heroIsIP: game.heroIsIP, heroRange: game.heroRange, villainRange: game.villainRange,
        villainPickedHand: game.villainPickedHand, villainPickedHandType: game.villainPickedHandType,
        board: game.board as Card[], street: game.street,
        pot: afterHero.pot, heroStack: afterHero.heroStack, villainStack: afterHero.villainStack,
        heroAction, priorStreetActions,
        allHandActions: [...game.allActions, heroAction],
      });

      let finalStreetActions = newStreetActions;
      let finalAllActions = [...game.allActions, heroAction];
      let { pot: finalPot, heroStack: finalHeroStack, villainStack: finalVillainStack } = afterHero;

      if (villainMustAct && resp.villain) {
        const villainAction: StreetAction = { player: 'villain', type: resp.villain.action, amount: resp.villain.amount };
        const afterVillain = applyChips(finalPot, finalHeroStack, finalVillainStack, villainAction);
        finalPot = afterVillain.pot;
        finalHeroStack = afterVillain.heroStack;
        finalVillainStack = afterVillain.villainStack;
        finalStreetActions = [...newStreetActions, villainAction];
        finalAllActions = [...finalAllActions, villainAction];
      }

      setGame(prev => ({
        ...prev,
        streetActions: finalStreetActions,
        allActions: finalAllActions,
        pot: finalPot, heroStack: finalHeroStack, villainStack: finalVillainStack,
        lastComment: resp.comment,
        lastVillainAction: villainMustAct ? (resp.villain ?? null) : null,
        phase: 'showing_result', error: null,
      }));
    } catch (err) {
      setGame(prev => ({
        ...prev, phase: 'hero_turn',
        error: err instanceof Error ? err.message : 'Erreur API',
      }));
    }
  }, [game, apiKey]);

  const handleContinueAfterResult = useCallback(() => {
    const next = getNextActor(game.streetActions, game.heroIsIP);

    if (next.who === 'hand_over') {
      triggerHandOver(game);
      return;
    }
    if (next.who === 'done') {
      const ns = nextStreet(game.street);
      if (!ns) {
        triggerHandOver(game);
      } else {
        setGame(prev => ({ ...prev, phase: 'next_street' }));
      }
      return;
    }
    setGame(prev => ({ ...prev, phase: 'hero_turn' }));
  }, [game, triggerHandOver]);

  const handleDealNextStreet = useCallback(() => {
    const ns = nextStreet(game.street);
    if (!ns) { triggerHandOver(game); return; }

    const newCards = dealCards(1, game.board as Card[]);
    const newBoard = [...game.board, ...newCards] as Card[];
    const firstPhase: GameState['phase'] = game.heroIsIP ? 'villain_turn' : 'hero_turn';

    const newGame: GameState = {
      ...game,
      board: newBoard,
      street: ns as Street,
      streetActions: [],
      phase: firstPhase,
      lastComment: null,
      lastVillainAction: null,
      handReview: null,
      error: null,
    };

    setGame(newGame);
    if (firstPhase === 'villain_turn') triggerVillainFirst(newGame);
  }, [game, triggerVillainFirst, triggerHandOver]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const { heroHand, heroHandType, board, street, pot, heroStack, villainStack,
    heroIsIP, heroRange, villainRange, phase, lastComment,
    streetActions, error, handReview } = game;

  const next = getNextActor(streetActions, heroIsIP);
  const facingBet = next.who === 'hero' && next.facingBet ? next.facingBet : 0;
  const isLoading = phase === 'loading' || phase === 'reviewing';

  const continueLabel = (() => {
    const n = getNextActor(game.streetActions, game.heroIsIP);
    if (n.who === 'hand_over') return 'Fin de main →';
    if (n.who === 'done') {
      const ns = nextStreet(street);
      return ns ? `Distribuer la ${ns === 'turn' ? 'Turn' : 'River'} →` : 'Fin de main →';
    }
    return 'Continuer →';
  })();

  // Outcome label for hand_over header
  const outcomeLabel = (() => {
    if (street === 'river') return 'River jouée — main terminée';
    if (next.who === 'hand_over' && next.winner === 'hero') return 'Villain fold — Pot remporté !';
    if (next.who === 'hand_over' && next.winner === 'villain') return 'Vous avez foldé.';
    return 'Main terminée.';
  })();

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '12px 12px 40px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
          <a href="/postflop/" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Setup
          </a>
          <span style={{
            fontSize: '0.65rem', color: '#6b7280', background: '#1a1f2e',
            border: '1px solid #2e3650', borderRadius: 20, padding: '3px 9px',
          }}>
            🤖 {AI_LABEL}
          </span>
        </div>

        {/* Poker table */}
        <div style={{ background: '#080e08', borderRadius: 16, overflow: 'hidden', border: '1px solid #1a3a1a' }}>
          <PostflopTable
            heroHand={heroHand as [Card, Card]}
            heroHandType={heroHandType}
            heroPos={heroRange.position}
            heroStack={heroStack}
            heroIsIP={heroIsIP}
            villainPos={villainRange.position}
            villainStack={villainStack}
            villainHand={(phase === 'hand_over' || phase === 'reviewing') ? game.villainPickedHand : null}
            board={board as Card[]}
            street={street}
            pot={pot}
            streetActions={streetActions}
            loading={isLoading}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#2d0f0f', border: '1px solid #7f1d1d', borderRadius: 8,
            padding: '10px 14px', fontSize: '0.82rem', color: '#fca5a5',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div style={{
            background: '#0f1a2e', border: '1px solid #1e3a5f', borderRadius: 10,
            padding: '12px 14px', textAlign: 'center', color: '#60a5fa', fontSize: '0.85rem',
          }}>
            {phase === 'reviewing' ? '📖 Révélation de la main Villain…' : '🧠 Analyse en cours…'}
          </div>
        )}

        {/* Hero action */}
        {phase === 'hero_turn' && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '12px 14px',
          }}>
            <div style={{ fontSize: '0.7rem', color: '#93c5fd', fontWeight: 800, marginBottom: 10, letterSpacing: '0.08em' }}>
              {facingBet > 0
                ? `VOTRE ACTION — face à ${facingBet.toFixed(1)}bb`
                : `VOTRE ACTION — pot de ${pot.toFixed(1)}bb`}
            </div>
            <ActionButtons
              pot={pot}
              stack={heroStack}
              facingBet={facingBet}
              onAction={handleHeroAction}
            />
          </div>
        )}

        {/* GTO comment */}
        {phase === 'showing_result' && lastComment && (
          <CommentBox
            comment={lastComment}
            onContinue={handleContinueAfterResult}
            continueLabel={continueLabel}
          />
        )}

        {/* Next street */}
        {phase === 'next_street' && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 14, textAlign: 'center',
          }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 12px' }}>
              Street terminé.
            </p>
            <button
              onClick={handleDealNextStreet}
              style={{
                padding: '10px 24px', background: '#14532d', border: '1px solid #15803d',
                borderRadius: 8, color: '#86efac', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Distribuer la {nextStreet(street) === 'turn' ? 'Turn' : 'River'} →
            </button>
          </div>
        )}

        {/* Hand over — shown during reviewing too (table visible, loading banner above) */}
        {(phase === 'hand_over' || phase === 'reviewing') && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 18,
          }}>
            {/* Outcome */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>
                {next.who === 'hand_over' && next.winner === 'hero' ? '🏆' :
                 next.who === 'hand_over' && next.winner === 'villain' ? '😔' : '🤝'}
              </div>
              <p style={{ color: 'var(--text)', fontSize: '0.95rem', fontWeight: 700, margin: '0 0 4px' }}>
                {outcomeLabel}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
                {(board as Card[]).join(' ')} · {heroHand.join(' ')} ({heroHandType})
              </p>
            </div>

            {/* Review loading placeholder */}
            {phase === 'reviewing' && (
              <div style={{
                background: '#1a1200', border: '1px solid #78350f', borderRadius: 10,
                padding: '14px', textAlign: 'center', marginBottom: 14,
              }}>
                <p style={{ color: '#f59e0b', fontSize: '0.83rem', margin: 0 }}>
                  🃏 Révélation de la main Villain en cours…
                </p>
              </div>
            )}

            {/* Hand review */}
            {handReview && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  background: '#1a1200', border: '1px solid #92400e', borderRadius: 10,
                  padding: '10px 14px', marginBottom: 10,
                }}>
                  <div style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 800, marginBottom: 4 }}>
                    🃏 MAIN DU VILLAIN
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fde68a', marginBottom: 6 }}>
                    {handReview.villainHand}
                  </div>
                  <p style={{ fontSize: '0.83rem', color: '#c8b068', margin: 0, lineHeight: 1.5 }}>
                    {handReview.summary}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {handReview.items.map((item, i) => (
                    <div key={i} style={{
                      background: item.player === 'hero' ? '#0f1a30' : '#1a1008',
                      border: `1px solid ${item.player === 'hero' ? '#1d4ed8' : '#78350f'}`,
                      borderRadius: 8, padding: '8px 12px',
                    }}>
                      <div style={{
                        fontSize: '0.68rem', fontWeight: 800, marginBottom: 3,
                        color: item.player === 'hero' ? '#60a5fa' : '#f59e0b',
                        letterSpacing: '0.06em',
                      }}>
                        {item.player === 'hero' ? '▶ VOUS' : '● VILLAIN'} · {item.action}
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#c8d0e0', margin: 0, lineHeight: 1.5 }}>
                        {item.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action history */}
            {game.allActions.length > 0 && (
              <div style={{
                background: 'var(--surface2)', borderRadius: 8,
                padding: '10px 12px', marginBottom: 14,
              }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.08em' }}>
                  HISTORIQUE
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {game.allActions.map((a, i) => (
                    <span key={i} style={{ fontSize: '0.72rem', color: a.player === 'hero' ? '#93c5fd' : '#fde68a' }}>
                      {a.player === 'hero' ? 'Vous' : 'Villain'}: {actionLabel(a)}
                      {i < game.allActions.length - 1 ? ' →' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons — only once review is done (or errored) */}
            {phase === 'hand_over' && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={onNewHand}
                  style={{
                    padding: '10px 22px', background: '#1d4ed8', border: '1px solid #3b82f6',
                    borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Nouvelle main →
                </button>
                <button
                  onClick={() => { window.location.href = '/postflop/'; }}
                  style={{
                    padding: '10px 22px', background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                >
                  Changer de setup
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#374151' }}>
          {heroRange.position} vs {villainRange.position} · {streetLabel(street)} · SRP HU
        </div>
      </div>
    </div>
  );
}
