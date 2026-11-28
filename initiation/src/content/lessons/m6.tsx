/** Module 6 · Repères chiffrés et vocabulaire : leçons 18, 19 et 20 (bonus). */
import type { ChoiceItem, EstimateItem, Item, Lesson, MatchItem } from '../types';
import { CardRow } from '../../components/Cards';
import { T } from '../../components/Term';
import { Narr, sample, trueFalse, withIds } from '../helpers';
import { INIT_TERMS as TERMS, type Term } from '../lexique';
import { cards, draw, suitOf } from '../../lib/cards';
import { equityRun, share } from '../../lib/sims';

// ════════════════════════════════════════════════════════════════════════════
// Leçon 18 · Les chiffres à connaître
// ════════════════════════════════════════════════════════════════════════════

const N = 2000;
const freq = (trial: () => boolean) => () => { let k = 0; for (let i = 0; i < N; i++) if (trial()) k++; return k / N; };

function est(id: string, prompt: string, answer: number, tolerance: number, max: number, step: number, simulate: () => number, feedback: string, insight: string): EstimateItem {
  return { kind: 'estimate', id, prompt, min: 0, max, step, answer, tolerance, unit: '%', simulate, simLabel: 'Simulation en direct', feedback, insight };
}

const L18: Lesson = {
  id: 18, module: 6,
  title: 'Les chiffres à connaître',
  objective: 'Avoir en tête les ordres de grandeur utiles à la table.',
  defi: {
    intro: <p>Dix questions d’estimation. Déplace le curseur selon ton intuition, puis une simulation en direct révèle la réponse. Les écarts sont parfois surprenants !</p>,
    items: () => [
      est('l18-1', 'Sur 100 mains, combien de fois reçois-tu une paire servie ?', 6, 2, 30, 1,
        freq(() => { const [a, b] = draw(2); return a[0] === b[0]; }), 'Environ 6 fois sur 100 : une main sur 17.', 'Une paire servie : environ 1 main sur 17 (6 %).'),
      est('l18-2', 'Sur 100 mains, combien de fois reçois-tu deux cartes assorties (de la même enseigne) ?', 24, 5, 60, 1,
        freq(() => { const [a, b] = draw(2); return a[1] === b[1]; }), 'Environ 24 fois sur 100 : près d’une main sur quatre.', 'Deux cartes assorties : environ 1 main sur 4.'),
      est('l18-3', 'Tu as une paire servie. Combien de fois sur 100 le flop te donne-t-il un brelan (ou mieux) ?', 12, 4, 50, 1,
        freq(() => { const f = draw(3, ['7s', '7h']); return f.some(c => c[0] === '7'); }), 'Environ 12 fois sur 100 : une fois sur 8 à 9.', 'Avec une paire servie, on touche un brelan au flop environ 1 fois sur 8.'),
      est('l18-4', 'Tu as deux cartes assorties. Combien de fois sur 100 le flop te donne-t-il directement une couleur ?', 0.8, 1, 20, 0.5,
        freq(() => { const f = draw(3, ['Ah', 'Kh']); return f.every(c => suitOf(c) === 'h'); }), 'Moins d’une fois sur 100 (0,8 %) ! Être assorti aide, mais rarement.', 'Une couleur faite au flop avec des cartes assorties : moins d’1 fois sur 100.'),
      est('l18-5', 'Tu as un tirage couleur au flop. Combien de fois sur 100 la couleur rentre-t-elle d’ici la river ?', 35, 5, 100, 1,
        freq(() => { const r = draw(2, ['Ah', '7h', 'Kh', '9h', '2c']); return r.some(c => suitOf(c) === 'h'); }), 'Environ 35 fois sur 100 : un peu plus d’une fois sur trois.', 'Tirage couleur au flop : environ 35 % d’ici la river.'),
      est('l18-6', 'Tu as A-K. Combien de fois sur 100 touches-tu au moins une paire (un as ou un roi) au flop ?', 32, 6, 100, 1,
        freq(() => draw(3, ['As', 'Kd']).some(c => c[0] === 'A' || c[0] === 'K')), 'Environ 32 fois sur 100 : AK rate le flop deux fois sur trois.', 'AK ne touche le flop qu’environ 1 fois sur 3.'),
      est('l18-7', 'AK contre une paire de 2, tapis avant le flop. Combien de fois sur 100 AK gagne-t-il ?', 47, 5, 100, 1,
        () => share(equityRun(cards('Ah Kd'), cards('2s 2c'), [], 400), 'a'), 'Environ 47 sur 100 : c’est un coin flip, avec un léger avantage à la paire.', 'Paire contre deux cartes plus hautes : environ 50/50, le coin flip.'),
      est('l18-8', 'Paire d’as contre paire de rois, tapis avant le flop. Combien de fois sur 100 les rois gagnent-ils ?', 18, 5, 100, 1,
        () => share(equityRun(cards('As Ac'), cards('Kh Kd'), [], 400), 'b'), 'Environ 18 fois sur 100 : à peu près une fois sur cinq.', 'Paire contre paire plus petite : environ 80/20.'),
      est('l18-9', 'Tu as une paire de rois. Combien de fois sur 100 au moins un as tombe-t-il au flop ?', 23, 5, 100, 1,
        freq(() => draw(3, ['Ks', 'Kh']).some(c => c[0] === 'A')), 'Environ 23 fois sur 100 : près d’une fois sur quatre.', 'Avec KK, un as tombe au flop presque 1 fois sur 4.'),
      est('l18-10', 'Une main dominée (AQ contre AK), tapis avant le flop. Combien de fois sur 100 AQ gagne-t-il ?', 26, 6, 100, 1,
        () => share(equityRun(cards('Ad Qc'), cards('Ah Ks'), [], 400), 'a'), 'Environ 26 fois sur 100 : une main dominée gagne une fois sur quatre.', 'Main dominée : environ 25 % de chances.'),
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <table className="tbl">
          <thead><tr><th>Situation</th><th className="r">Fréquence</th></tr></thead>
          <tbody>
            {[
              ['Recevoir une paire servie', '1 sur 17 (6 %)'], ['Recevoir une paire d’as', '1 sur 221'], ['Recevoir deux cartes assorties', '1 sur 4 (24 %)'],
              ['Paire servie : brelan au flop', '1 sur 8,5 (12 %)'], ['Cartes assorties : couleur faite au flop', '0,8 %'], ['AK : au moins une paire au flop', '32 %'],
              ['KK : un as au flop', '23 %'], ['Tirage couleur : flop → river', '35 %'], ['Suite ouverte : flop → river', '31 %'],
              ['Paire contre deux cartes plus hautes', 'env. 50/50'], ['Paire contre paire plus petite', 'env. 80/20'], ['Main dominée (AQ contre AK)', 'env. 25 %'],
            ].map(([a, b]) => <tr key={a}><td>{a}</td><td className="r">{b}</td></tr>)}
          </tbody>
        </table>
        <div className="key-box prose">
          <h3>À retenir</h3>
          <ul>
            <li>Les belles mains sont rares : une paire 1 fois sur 17, AA 1 fois sur 221. La patience fait partie du jeu.</li>
            <li>Le flop rate souvent : même AK ne touche qu’1 fois sur 3. Ne t’accroche pas à une main qui n’a rien touché.</li>
            <li>Un <T k="coinflip">coin flip</T> (paire contre deux cartes plus hautes) est presque du 50/50 : ne mets pas ton tournoi en jeu à la légère.</li>
          </ul>
        </div>
      </div>
    ),
  },
  training: {
    items: () => withIds(sample<Item>([
      trueFalse('', 'On reçoit une paire servie environ une main sur 17.', true, 'Vrai : 6 % des mains.'),
      trueFalse('', 'AK touche au moins une paire au flop une fois sur deux.', false, 'Faux : environ une fois sur trois (32 %).'),
      trueFalse('', 'Paire d’as contre paire de rois : les as gagnent environ 8 fois sur 10.', true, 'Vrai : environ 82 %.'),
      trueFalse('', 'Avec des cartes assorties, on fait couleur au flop environ une fois sur dix.', false, 'Faux : moins d’une fois sur 100 (0,8 %).'),
      trueFalse('', 'Un tirage couleur au flop rentre d’ici la river environ une fois sur trois.', true, 'Vrai : environ 35 %.'),
      trueFalse('', 'Une paire de 2 contre AK, c’est environ 50/50.', true, 'Vrai : c’est un coin flip (environ 52/48 pour la paire).'),
      trueFalse('', 'Avec une paire servie, on touche un brelan au flop une fois sur trois.', false, 'Faux : environ une fois sur huit (12 %).'),
      trueFalse('', 'Une main dominée (AQ contre AK) gagne environ une fois sur quatre.', true, 'Vrai : environ 25 %.'),
      trueFalse('', 'On reçoit une paire d’as environ une fois sur 50 mains.', false, 'Faux : une fois sur 221.'),
      trueFalse('', 'Avec KK, un as tombe au flop presque une fois sur quatre.', true, 'Vrai : environ 23 %.'),
      trueFalse('', 'Une suite ouverte au flop se complète d’ici la river environ une fois sur trois.', true, 'Vrai : environ 31 %.'),
      trueFalse('', 'Une main assortie gagne environ 15 % plus souvent que la même main dépareillée.', false, 'Faux : seulement 2 à 3 % de plus.'),
    ], 10), 'l18t'),
  },
  fiche: {
    essentiel: [
      'Les belles mains sont rares : une paire 1 fois sur 17, AA 1 fois sur 221.',
      'Le flop rate souvent : AK ne touche qu’une fois sur trois.',
      'Paire contre deux cartes plus hautes : environ 50/50 (coin flip).',
      'Paire contre paire plus petite : environ 80/20. Main dominée : environ 25 %.',
    ],
    blocks: [{
      kind: 'table', title: 'Les 12 chiffres à connaître', head: ['Situation', 'Fréquence'], rows: [
        ['Recevoir une paire servie', '1 sur 17 (6 %)'], ['Recevoir une paire d’as', '1 sur 221'], ['Recevoir deux cartes assorties', '1 sur 4 (24 %)'],
        ['Paire servie : brelan au flop', '1 sur 8,5 (12 %)'], ['Cartes assorties : couleur faite au flop', '0,8 %'], ['AK : au moins une paire au flop', '32 %'],
        ['KK : un as au flop', '23 %'], ['Tirage couleur : flop -> river', '35 %'], ['Suite ouverte : flop -> river', '31 %'],
        ['Paire contre deux cartes plus hautes', 'env. 50/50'], ['Paire contre paire plus petite', 'env. 80/20'], ['Main dominée (AQ contre AK)', 'env. 25 %'],
      ],
    }],
    pieges: ['Surestimer ses chances de toucher le flop.', 'Croire qu’être assorti change beaucoup la force d’une main.'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 19 · Le vocabulaire du joueur
// ════════════════════════════════════════════════════════════════════════════

const COMMENTARY = (
  <Narr lines={[
    <>Blindes 100/200. Bob, UTG, <strong>limpe</strong>. Carla, au CO, <strong>isole</strong> à 800.</>,
    <>Le bouton <strong>3-bet</strong> à 2 400 : Bob se couche, Carla suit.</>,
    <><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><CardRow cs="Ks 7d 2c" size="xs" gap={2} /></span> Flop sec. Le bouton fait un <strong>c-bet</strong> d’un tiers du pot.</>,
    <>Carla, avec 7♥7♣, a touché son <strong>set</strong> : elle se contente de suivre.</>,
    <>Turn 3♥. Le bouton, qui a une paire d’as, fait tapis ; Carla suit. River 9♦ : le set de Carla l’emporte.</>,
    <>Furieux, le bouton parle de <strong>bad beat</strong> et part en <strong>tilt</strong>.</>,
  ]} />
);

function vocab(id: string, prompt: string, options: string[], answer: number, insight: string, feedback?: string): ChoiceItem {
  return { kind: 'choice', id, prompt, scene: COMMENTARY, options, answer, insight, feedback };
}

function matchRound(id: string): MatchItem {
  const pool = TERMS.filter(t => t.def.length < 110);
  const pairs = sample<Term>(pool, 5).map(t => [t.term, t.def] as [string, string]);
  return { kind: 'match', id, prompt: 'Associe chaque mot à sa définition.', pairs };
}

const THEMES = [...new Set(TERMS.map(t => t.theme))];

const L19: Lesson = {
  id: 19, module: 6,
  title: 'Le vocabulaire du joueur',
  objective: 'Comprendre le jargon des joueurs, en français et en anglais.',
  defi: {
    intro: <p>Voici le commentaire d’une main, écrit comme le raconterait un joueur. Il est plein de jargon : devine le sens des mots en gras grâce au contexte.</p>,
    items: () => [
      vocab('l19-1', '« Bob limpe » veut dire…', ['Il suit simplement la grosse blinde', 'Il relance', 'Il se couche'], 0, 'Limper : entrer dans le coup en suivant la grosse blinde, sans relancer.'),
      vocab('l19-2', '« Carla isole à 800 » veut dire…', ['Elle relance pour jouer seule contre Bob', 'Elle se met à l’écart du coup', 'Elle mise tous ses jetons'], 0, 'Isoler : relancer après un limp pour jouer seul contre ce joueur.'),
      vocab('l19-3', '« Le bouton 3-bet » veut dire…', ['Il mise trois grosses blindes', 'Il relance une relance', 'Il joue contre trois adversaires'], 1, '3-bet : relancer une relance (la grosse blinde est la 1re mise, l’ouverture la 2e).'),
      vocab('l19-4', '« Le bouton fait un c-bet » veut dire…', ['Il mise au flop, après avoir été le dernier à relancer préflop', 'Il checke', 'Il fait tapis'], 0, 'C-bet : la mise au flop de celui qui a relancé en dernier avant le flop.'),
      vocab('l19-5', '« Carla a touché son set » veut dire…', ['Elle a un brelan grâce à sa paire servie', 'Elle a une couleur', 'Elle a deux paires'], 0, 'Set : brelan formé avec une paire servie et une carte du board.'),
      vocab('l19-6', 'Le bouton a-t-il raison de parler de « bad beat » ?', ['Oui : il a perdu avec une paire d’as', 'Non : à la turn, Carla était déjà très favorite'], 1, 'Bad beat : perdre un coup alors qu’on était très favori.', 'Un bad beat, c’est perdre en étant très favori. Ici, à la turn, le set de Carla gagnait déjà environ 9 fois sur 10.'),
      vocab('l19-7', '« Partir en tilt » veut dire…', ['S’énerver et se mettre à mal jouer', 'Quitter la table', 'Gagner plusieurs coups d’affilée'], 0, 'Tilt : état d’énervement qui fait mal jouer.'),
    ],
  },
  bilan: {
    body: (
      <div className="stack">
        <p>Tout le vocabulaire du parcours, classé par thème. Touche un mot pour revoir sa définition. Tu retrouves aussi ce lexique dans l’onglet « Lexique ».</p>
        {THEMES.map(th => (
          <div key={th} className="card tight">
            <h3 className="mb">{th}</h3>
            <div>{TERMS.filter(t => t.theme === th).map(t => <span key={t.key} className="term-chip"><T k={t.key}>{t.term}</T>{t.en && t.en.toLowerCase() !== t.term.toLowerCase() ? <span className="muted"> · {t.en}</span> : null}</span>)}</div>
          </div>
        ))}
      </div>
    ),
  },
  training: {
    intro: <p>Trois manches d’association. Une manche est réussie avec une erreur au plus.</p>,
    items: () => [matchRound('l19t0'), matchRound('l19t1'), matchRound('l19t2')],
  },
  fiche: {
    essentiel: ['Le jargon du poker mêle le français et l’anglais : il faut connaître les deux.', 'Le lexique complet du parcours figure ci-dessous, classé par thème.'],
    blocks: THEMES.map(th => ({
      kind: 'table' as const, title: th, head: ['Mot', 'Anglais', 'Définition'], widths: [35, 30, 115],
      rows: TERMS.filter(t => t.theme === th).map(t => [t.term, t.en ?? '', t.def]),
    })),
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Leçon 20 (bonus) · Règles et étiquette en club
// ════════════════════════════════════════════════════════════════════════════

const ARB = 'Que décide l’arbitre ?';
const SCENES: (() => ChoiceItem)[] = [
  () => ({ kind: 'choice', id: '', prompt: <>Face à une mise de 300, David pose 300 devant lui, puis retourne à son tapis chercher 600 de plus, sans rien annoncer. {ARB}</>, options: ['Il a relancé à 900', 'Il a seulement suivi : seul le premier geste compte', 'Le coup est annulé'], answer: 1, insight: 'Une mise se pose en un seul geste, ou s’annonce. Sinon, seul le premier geste compte (string bet).', feedback: 'Aller chercher des jetons en plusieurs fois sans annonce est un « string bet » : seul le premier geste compte, il a donc suivi.' }),
  () => ({ kind: 'choice', id: '', prompt: <>Face à une mise de 400, Emma pose en silence un seul jeton de 1 000. {ARB}</>, options: ['Elle relance à 1 000', 'Elle suit : un gros jeton posé sans annonce vaut un simple suivi', 'Elle doit reprendre son jeton'], answer: 1, insight: 'Un seul gros jeton posé sans annonce vaut un simple suivi.', feedback: 'Pour relancer avec un gros jeton, il faut l’annoncer avant de le poser.' }),
  () => ({ kind: 'choice', id: '', prompt: <>Farid dit « je relance », puis pose seulement le montant pour suivre. {ARB}</>, options: ['Il a suivi', 'Il doit relancer, au moins du minimum', 'Il choisit'], answer: 1, insight: 'Une annonce verbale engage le joueur.', feedback: 'Ce qui est dit est dû : il doit compléter au moins jusqu’à la relance minimale.' }),
  () => ({ kind: 'choice', id: '', prompt: 'À la river, Alice a misé et Bob a suivi. Qui montre ses cartes en premier ?', options: ['Alice, la dernière à avoir misé', 'Bob', 'Le joueur le plus proche du bouton'], answer: 0, insight: 'À l’abattage, le dernier joueur à avoir misé ou relancé montre en premier.', feedback: 'Celui qui a misé en dernier montre en premier. Bob peut ensuite montrer ou jeter sa main.' }),
  () => ({ kind: 'choice', id: '', prompt: <>Carla annonce « deux paires » et retourne ses cartes : elle a en fait une suite. {ARB}</>, options: ['Sa main vaut deux paires, comme annoncé', 'Sa main vaut une suite : les cartes parlent', 'Sa main est morte'], answer: 1, insight: 'Les cartes parlent : une main vaut ce que montrent ses cartes.', feedback: 'Peu importe l’annonce : une fois les cartes retournées, c’est leur valeur qui compte.' }),
  () => ({ kind: 'choice', id: '', prompt: <>Hugo jette ses cartes faces cachées sur le tas des cartes écartées, puis s’aperçoit qu’il avait la meilleure main. {ARB}</>, options: ['Il peut les récupérer', 'Sa main est morte', 'On rejoue le coup'], answer: 1, insight: 'Une main jetée dans le muck est morte.', feedback: 'Une main qui touche le muck (le tas des cartes écartées) ne peut plus gagner.' }),
  () => ({ kind: 'choice', id: '', prompt: <>Gaëlle, déjà couchée, s’exclame pendant le coup : « J’avais jeté un roi ! » {ARB}</>, options: ['Aucun problème', 'Interdit : on ne commente pas un coup en cours', 'Le coup est annulé'], answer: 1, insight: 'On ne commente pas un coup en cours : cela donne des informations aux joueurs encore en jeu.', feedback: 'Cette information aide les joueurs encore en jeu. Elle mérite un avertissement.' }),
  () => ({ kind: 'choice', id: '', prompt: <>Bob se couche alors que ce n’est pas encore à lui de parler. {ARB}</>, options: ['Son action compte : il est couché (et reçoit un avertissement)', 'Son action est annulée, il rejoue à son tour', 'Le coup est annulé'], answer: 0, insight: 'On agit à son tour. Une action hors de son tour engage en général le joueur.', feedback: 'En règle générale, une action hors de son tour est maintenue si rien n’a changé avant son tour. Ici, il est couché.' }),
  () => ({ kind: 'choice', id: '', prompt: <>Ton adversaire a misé. Tu annonces « je suis », puis, après réflexion, tu veux te coucher. {ARB}</>, options: ['Tu dois suivre', 'Tu peux te coucher'], columns: 2, answer: 0, feedback: 'L’annonce verbale t’engage : tu dois suivre.' }),
  () => ({ kind: 'choice', id: '', prompt: <>Un joueur lance ses jetons au milieu du pot, mélangés aux autres. {ARB}</>, options: ['Interdit : on pose ses jetons devant soi pour qu’ils soient comptés', 'Autorisé si le montant est juste'], answer: 0, feedback: 'On pose ses jetons devant soi : sinon personne ne peut vérifier le montant.' }),
  () => ({ kind: 'choice', id: '', prompt: <>Un joueur garde ses gros jetons cachés derrière ses petits. {ARB}</>, options: ['Interdit : son tapis doit rester visible, gros jetons bien en vue', 'Autorisé'], answer: 0, feedback: 'Chacun doit pouvoir estimer le tapis des autres : les gros jetons doivent rester visibles.' }),
  () => ({ kind: 'choice', id: '', prompt: <>Un joueur montre ses cartes à son voisin pendant le coup. {ARB}</>, options: ['Interdit : un seul joueur par main', 'Autorisé si le voisin est couché'], answer: 0, feedback: 'Chacun joue seul sa main : on ne montre pas ses cartes et on ne demande pas conseil pendant le coup.' }),
  () => ({ kind: 'choice', id: '', prompt: 'À la river, tout le monde checke. Qui montre ses cartes en premier ?', options: ['Le premier joueur encore en jeu à gauche du bouton', 'Le bouton', 'Celui qui pense avoir la meilleure main'], answer: 0, feedback: 'Sans mise au dernier tour, on montre dans l’ordre de parole : le premier à gauche du bouton commence.' }),
];

const RULES = [
  'J’agis à mon tour, jamais avant.',
  'J’annonce mon action : ce que je dis m’engage.',
  'Je pose mes jetons en un seul geste, devant moi (pas dans le pot).',
  'Un gros jeton posé sans annonce vaut un simple suivi.',
  'Je garde mon tapis visible, gros jetons bien en vue.',
  'Je protège mes cartes ; une main jetée dans le muck est morte.',
  'À l’abattage, le dernier à avoir misé montre en premier.',
  'Les cartes parlent : ma main vaut ce que montrent mes cartes.',
  'Je ne commente pas un coup en cours, même couché.',
  'Je reste courtois : on gagne et on perd avec le sourire.',
];

const L20: Lesson = {
  id: 20, module: 6, bonus: true,
  title: 'Règles et étiquette en club',
  objective: 'Connaître les règles de table pour jouer sereinement en club.',
  defi: {
    intro: <p>Tu es le directeur de tournoi. Pour chaque scène, tranche : qu’est-ce que l’arbitre doit décider ?</p>,
    items: () => withIds(SCENES.slice(0, 8).map(f => f()), 'l20-'),
  },
  bilan: {
    body: (
      <div className="stack">
        <div className="key-box">
          <h3>Les 10 règles d’or du club</h3>
          <ol className="steps mt">{RULES.map(r => <li key={r}>{r}</li>)}</ol>
        </div>
        <p className="muted small">Vocabulaire : <T k="stringbet">string bet</T>, <T k="annonce">annonce verbale</T>, <T k="muck">muck</T>, <T k="cartesparlent">les cartes parlent</T>. Ces règles suivent les usages internationaux des tournois (règles TDA). En cas de doute, c’est le règlement du club et le directeur de tournoi qui tranchent.</p>
      </div>
    ),
  },
  training: { items: () => withIds(sample(SCENES, 8).map(f => f()), 'l20t') },
  fiche: {
    essentiel: ['Ce que l’on annonce engage.', 'Une mise se pose en un seul geste.', 'Les cartes parlent.', 'Le règlement du club et le directeur de tournoi ont le dernier mot.'],
    blocks: [{ kind: 'steps', title: 'Les 10 règles d’or du club', steps: RULES }],
    pieges: ['Poser ses jetons en plusieurs fois sans rien annoncer.', 'Jeter ses cartes trop vite à l’abattage.', 'Commenter un coup en cours.'],
  },
};

export const LESSONS_M6 = [L18, L19, L20];
