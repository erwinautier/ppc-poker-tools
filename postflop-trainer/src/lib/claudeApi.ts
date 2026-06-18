import type { ClaudeResponse, VillainOnlyResponse, StreetAction, Card, Range, Street, HandReview } from '../types';
import { actionLabel, streetLabel } from './game';

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

export const AI_LABEL = 'Llama 3.3 70B · Groq';

function historyText(actions: StreetAction[]): string {
  if (actions.length === 0) return '(aucune action)';
  return actions.map(a => `${a.player === 'hero' ? 'Hero' : 'Villain'}: ${actionLabel(a)}`).join(' → ');
}

function boardText(board: Card[]): string {
  return board.join(' ');
}

const LANG_RULE = `IMPORTANT: Use English poker terms without translating them: call, check, bet, raise, fold, board, stack, pot, range, equity, bluff, value, draw, IP, OOP, GTO, overcards, nuts, donk, c-bet, 3-bet, float. Write explanations in French but keep poker terms in English.`;

function rangeText(r: Range): string {
  return `"${r.title}" (position: ${r.position}, stack: ${r.stackBB}bb)`;
}

export async function callClaudeAfterHeroAction(params: {
  apiKey: string;
  heroHand: [Card, Card];
  heroHandType: string;
  heroIsIP: boolean;
  heroRange: Range;
  villainRange: Range;
  villainPickedHand: [Card, Card];
  villainPickedHandType: string;
  board: Card[];
  street: Street;
  pot: number;
  heroStack: number;
  villainStack: number;
  heroAction: StreetAction;
  priorStreetActions: StreetAction[];
  allHandActions: StreetAction[];
}): Promise<ClaudeResponse> {
  const { apiKey, heroHand, heroHandType, heroIsIP, heroRange, villainRange,
    villainPickedHand, villainPickedHandType,
    board, street, pot, heroStack, villainStack, heroAction, allHandActions } = params;

  const heroPos = heroIsIP ? 'IP (en position)' : 'OOP (hors position)';
  const villainPos = heroIsIP ? 'OOP' : 'IP';

  const facingHeroBet = heroAction.type === 'bet' || heroAction.type === 'raise' || heroAction.type === 'all_in';
  const villainOptions = facingHeroBet
    ? '"fold" si la main est trop faible face au bet, "call" pour continuer, "raise" ou "all_in" avec des mains très fortes (sets, deux paires, nuts draws)'
    : '"check" pour contrôler, "bet" avec des mains qui ont de la valeur ou des bluffs avec équité';

  const prompt = `Tu es un solver GTO de poker NLHE 6-max. Analyse l'action de Hero et simule la réponse du Villain.
${LANG_RULE}

SITUATION:
- Street : ${streetLabel(street)} | Board : ${boardText(board)}
- Pot : ${pot.toFixed(1)}bb | Stack Hero : ${heroStack.toFixed(1)}bb | Stack Villain : ${villainStack.toFixed(1)}bb
- Hero : ${heroHand.join(' ')} (${heroHandType}) — ${heroPos}
- Villain : ${villainPickedHand.join(' ')} (${villainPickedHandType}) — ${villainPos}
- Range Hero : ${rangeText(heroRange)} | Range Villain : ${rangeText(villainRange)}
- Historique complet : ${historyText(allHandActions)}
- ACTION HERO : ${actionLabel(heroAction)}

Fournis :
1. "gtoAction" : l'action GTO optimale pour Hero dans ce spot ("check", "bet", "call", "fold", "raise", "all_in")
2. "gtoAmount" : montant en BB si gtoAction est bet/raise/call (sinon OMETTRE)
3. "comment" : 1-2 phrases expliquant POURQUOI c'est la bonne action (fréquences, range advantage, board texture). Ne mentionne PAS la main du Villain.
4. "villain" : réponse cohérente avec ${villainPickedHand.join(' ')} (${villainPickedHandType}). ${villainOptions}. Ne fold/call pas automatiquement.

Réponds UNIQUEMENT avec du JSON valide (sans markdown) :
{
  "gtoAction": "check"|"bet"|"call"|"fold"|"raise"|"all_in",
  "gtoAmount": <BB si applicable, sinon OMETTRE>,
  "comment": "ex: Sur ce board K72r, le range advantage IP justifie un c-bet ~45% en 33%. AhQh est trop faible pour bet — GTO checke ~60%.",
  "villain": {
    "action": "check"|"bet"|"call"|"fold"|"raise"|"all_in",
    "amount": <BB si applicable, sinon OMETTRE>
  }
}`;

  return callGroq<ClaudeResponse>(apiKey, prompt, 400);
}

export async function callClaudeVillainFirst(params: {
  apiKey: string;
  heroHand: [Card, Card];
  heroHandType: string;
  heroIsIP: boolean;
  heroRange: Range;
  villainRange: Range;
  villainPickedHand: [Card, Card];
  villainPickedHandType: string;
  board: Card[];
  street: Street;
  pot: number;
  heroStack: number;
  villainStack: number;
  allHandActions: StreetAction[];
}): Promise<VillainOnlyResponse> {
  const { apiKey, heroIsIP, villainRange,
    villainPickedHand, villainPickedHandType,
    board, street, pot, heroStack, villainStack, allHandActions } = params;

  const villainPos = heroIsIP ? 'OOP (hors position)' : 'IP (en position)';

  const prompt = `Tu es un simulateur de poker NLHE 6-max SRP HU. Simule l'action du Villain (${villainPos}) en début de street.
${LANG_RULE}
Villain a : ${villainPickedHand.join(' ')} (${villainPickedHandType}) — joue de façon COHÉRENTE avec cette main et l'historique.
Range Villain : ${rangeText(villainRange)}
Board : ${boardText(board)} | Street : ${streetLabel(street)} | Pot : ${pot.toFixed(1)}bb | Stacks Hero ${heroStack.toFixed(1)}bb / Villain ${villainStack.toFixed(1)}bb
Historique complet : ${historyText(allHandActions)}

Réponds UNIQUEMENT avec du JSON valide (sans markdown) :
{
  "villain": {
    "action": "check"|"bet",
    "amount": <BB si bet, sinon OMETTRE>
  }
}`;

  return callGroq<VillainOnlyResponse>(apiKey, prompt, 150);
}

export async function callClaudeHandReview(params: {
  apiKey: string;
  heroHand: [Card, Card];
  heroHandType: string;
  heroIsIP: boolean;
  heroRange: Range;
  villainRange: Range;
  villainPickedHand: [Card, Card];
  villainPickedHandType: string;
  board: Card[];
  allHandActions: StreetAction[];
}): Promise<HandReview> {
  const { apiKey, heroHand, heroHandType, heroIsIP, heroRange, villainRange,
    villainPickedHand, villainPickedHandType, board, allHandActions } = params;

  const heroPos = heroIsIP ? 'IP' : 'OOP';
  const villainPos = heroIsIP ? 'OOP' : 'IP';

  const prompt = `Tu es un coach poker GTO. La main est terminée. Explique chaque action en termes GTO.
${LANG_RULE}

Board final : ${boardText(board)}
Hero : ${heroHand.join(' ')} (${heroHandType}) — ${heroPos}
Villain : ${villainPickedHand.join(' ')} (${villainPickedHandType}) — ${villainPos}
Range Hero : ${rangeText(heroRange)} | Range Villain : ${rangeText(villainRange)}
Actions complètes : ${historyText(allHandActions)}

Pour chaque action Hero ET Villain, donne une explication GTO courte et concrète (fréquences, equity, pourquoi cette action avec cette main sur ce board).

Réponds UNIQUEMENT avec du JSON valide (sans markdown) :
{
  "villainHand": "${villainPickedHand.join('')}",
  "summary": "1-2 phrases résumant la dynamique de la main et les enseignements clés",
  "items": [
    { "player": "hero"|"villain", "action": "ex: Check flop", "explanation": "ex: GTO correct — trop faible pour bet sur ce board K72r..." }
  ]
}`;

  return callGroq<HandReview>(apiKey, prompt, 1000);
}

async function callGroq<T>(apiKey: string, prompt: string, maxTokens = 512): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Erreur API Groq : ${msg}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  const text = data.choices[0]?.message?.content ?? '';

  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error('Réponse Groq invalide (JSON attendu)');
  }
}
