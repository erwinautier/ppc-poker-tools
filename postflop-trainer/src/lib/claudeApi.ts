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
    board, street, pot, heroStack, villainStack, heroAction, priorStreetActions } = params;

  const heroPos = heroIsIP ? 'IP (en position)' : 'OOP (hors position)';

  const prompt = `Tu es un solver GTO de poker NLHE 6-max. Analyse l'action de Hero en la comparant à la stratégie GTO optimale.

SITUATION:
- Street : ${streetLabel(street)} | Board : ${boardText(board)}
- Pot : ${pot.toFixed(1)}bb | Stack Hero : ${heroStack.toFixed(1)}bb | Stack Villain : ${villainStack.toFixed(1)}bb
- Hero : ${heroHand.join(' ')} (${heroHandType}) — ${heroPos}
- Range Hero : ${rangeText(heroRange)} | Range Villain : ${rangeText(villainRange)}
- Actions précédentes ce street : ${historyText(priorStreetActions)}
- ACTION HERO : ${actionLabel(heroAction)}

Réponds UNIQUEMENT avec du JSON valide (sans markdown) :
{
  "comment": "2-3 phrases PRÉCISES et CHIFFRÉES comparant l'action de Hero à la GTO. Mentionne : fréquence GTO recommandée pour cette main dans ce spot, avantage de range, texture du board et pourquoi l'action est correcte ou non. Exemple de format attendu : 'Sur ce board K72r, IP bet ~45% en 33%. Votre main AhQh sans paire est trop faible pour être dans la range de bet — GTO la checke ~60%. Votre bet surreprésente votre range.'",
  "villain": {
    "action": "check"|"bet"|"call"|"fold"|"raise"|"all_in",
    "amount": <montant en BB si bet/raise/call, sinon OMETTRE ce champ>
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
  board: Card[];
  street: Street;
  pot: number;
  heroStack: number;
  villainStack: number;
  allHandActions: StreetAction[];
}): Promise<VillainOnlyResponse> {
  const { apiKey, heroIsIP, villainRange,
    board, street, pot, heroStack, villainStack, allHandActions } = params;

  const villainPos = heroIsIP ? 'OOP (hors position)' : 'IP (en position)';

  const prompt = `Tu es un simulateur de poker NLHE 6-max SRP HU. Simule l'action du Villain (${villainPos}) en début de street.
Range Villain : ${rangeText(villainRange)}
Board : ${boardText(board)} | Street : ${streetLabel(street)} | Pot : ${pot.toFixed(1)}bb | Stacks Hero ${heroStack.toFixed(1)}bb / Villain ${villainStack.toFixed(1)}bb
Historique : ${historyText(allHandActions)}

Réponds UNIQUEMENT avec du JSON valide (sans markdown) :
{
  "villain": {
    "action": "check"|"bet",
    "amount": <BB si bet, sinon OMETTRE ce champ>
  }
}`;

  return callGroq<VillainOnlyResponse>(apiKey, prompt, 100);
}

export async function callClaudeHandReview(params: {
  apiKey: string;
  heroHand: [Card, Card];
  heroHandType: string;
  heroIsIP: boolean;
  heroRange: Range;
  villainRange: Range;
  board: Card[];
  allHandActions: StreetAction[];
}): Promise<HandReview> {
  const { apiKey, heroHand, heroHandType, heroIsIP, heroRange, villainRange, board, allHandActions } = params;

  const heroPos = heroIsIP ? 'IP' : 'OOP';

  const prompt = `Tu es un coach poker GTO. La main est terminée. Révèle une main plausible pour le Villain selon sa range, et explique chaque action en termes GTO.

Board final : ${boardText(board)}
Hero : ${heroHand.join(' ')} (${heroHandType}) — ${heroPos}
Range Hero : ${rangeText(heroRange)}
Range Villain : ${rangeText(villainRange)}
Actions complètes : ${historyText(allHandActions)}

Choisis UNE main spécifique pour Villain cohérente avec ses actions (ex: "Kd8s").
Pour chaque action Hero ET Villain, donne une explication GTO courte et concrète.

Réponds UNIQUEMENT avec du JSON valide (sans markdown) :
{
  "villainHand": "ex: Kd8s",
  "summary": "1-2 phrases résumant la dynamique de la main et les enseignements clés",
  "items": [
    { "player": "hero"|"villain", "action": "ex: Check flop", "explanation": "ex: GTO correct — votre main est trop faible pour bet sur ce board..." }
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
