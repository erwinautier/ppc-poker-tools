import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getDA, logoFile, subscribeDA, toggleDA } from '../../../shared/ppc-da.js';
import { PARCOURS, PARCOURS_ORDER, type ParcoursDef, lessonById, lessonLabel, moduleLabel, moduleOf } from '../content';
import type { Lesson, ParcoursId } from '../content/types';
import { TERMS, altOf, termsOfLesson } from '../content/lexique';
import { labelForId } from '../content/labels';
import { PHASE_LABEL, getStore, isValidated, lessonProgress, resetAll, setLastParcours, setName, useStore } from '../lib/progress';
import { go } from '../lib/router';
const pdf = () => import('../lib/pdf');

const BASE = import.meta.env.BASE_URL;
const ORDER = PARCOURS_ORDER;

export function Header({ title, sub }: { title: string; sub: string }) {
  const da = useSyncExternalStore(subscribeDA, getDA);
  return (
    <div className="header">
      <a href="/" title="Toutes les applications du club"><img src={`${BASE}${logoFile(da)}`} alt="PPC" /></a>
      <div className="grow">
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
      <button type="button" className="ppc-da-switch" onClick={toggleDA} title="Changer de direction artistique" aria-label="Changer de direction artistique" />
    </div>
  );
}

// ── Accueil de l'Académie : choix du parcours ─────────────────────────────

export function Academie() {
  const store = useStore();
  return (
    <div className="stack">
      <Header title="Académie PPC" sub="Les cours interactifs du club" />
      <p className="muted small">Choisis ton parcours. Chacun a sa progression, ses fiches et son attestation.</p>
      {ORDER.map(id => {
        const def = PARCOURS[id];
        const validated = def.core.filter(l => isValidated(store.lessons[l.id])).length;
        const started = def.lessons.some(l => store.lessons[l.id]?.defiDone);
        const next = def.core.find(l => !isValidated(store.lessons[l.id]));
        const cta = !started ? 'Commencer' : next ? `Reprendre · leçon ${lessonLabel(next)} : ${next.title}` : 'Parcours terminé · revoir';
        return (
          <button key={id} className="card parcours-card" onClick={() => { setLastParcours(id); go({ name: 'parcours', p: id }); }}>
            <div className="row">
              <span className="pc-ico" aria-hidden="true">{def.icon}</span>
              <div className="grow">
                <div className="row between"><strong className="pc-title">{def.title}</strong><span className="pill">{def.level}</span></div>
                <div className="muted small">{def.lessons.length} leçons · {def.modules.length} modules</div>
              </div>
            </div>
            <p className="small">{def.blurb}</p>
            {started && (
              <div>
                <div className="row between"><span className="muted small">Ta progression</span><span className="muted small">{validated} / {def.core.length} leçons validées</span></div>
                <div className="bar" style={{ marginTop: 6 }}><div style={{ width: `${(validated / def.core.length) * 100}%` }} /></div>
              </div>
            )}
            <span className="pc-cta">{cta} →</span>
          </button>
        );
      })}

      {/* Seul accès interne à la page publique « Rejoindre le club » (rejoindre/), volontairement discret. */}
      <p className="muted center small">Envie de jouer en vrai ? <a href="/rejoindre/">Rejoindre le club</a></p>

      <p className="muted center small">Ta progression est enregistrée sur cet appareil uniquement.</p>
      <button className="btn ghost sm" style={{ alignSelf: 'center' }} onClick={() => {
        if (confirm('Effacer toute ta progression (tous les parcours : défis, scores, fiches débloquées) sur cet appareil ? Cette action est définitive.')) resetAll();
      }}>Remettre ma progression à zéro</button>
    </div>
  );
}

// ── Parcours ───────────────────────────────────────────────────────────────

export function Parcours({ p }: { p?: ParcoursId }) {
  const store = useStore();
  const id: ParcoursId = p ?? store.lastParcours ?? 'initiation';
  useEffect(() => { if (p) setLastParcours(p); }, [p]);
  return <ParcoursView key={id} def={PARCOURS[id]} />;
}

function ParcoursView({ def }: { def: ParcoursDef }) {
  const store = useStore();
  const { core, lessons, modules } = def;
  const validated = core.filter(l => isValidated(store.lessons[l.id])).length;
  const resume = core.find(l => !isValidated(store.lessons[l.id])) ?? lessons.find(l => !isValidated(store.lessons[l.id]));
  const resumeP = resume ? lessonProgress(resume.id) : null;
  const [openMods, setOpenMods] = useState<number[]>(() => [resume?.module ?? modules[0].id]);
  const toggle = (m: number) => setOpenMods(o => (o.includes(m) ? o.filter(x => x !== m) : [...o, m]));
  const done = validated === core.length;
  const initDone = PARCOURS.initiation.core.every(l => isValidated(store.lessons[l.id]));

  return (
    <div className="stack">
      <Header title={def.title} sub={def.sub} />
      <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => go({ name: 'academie' })}>← Tous les parcours</button>
      <div>
        <div className="row between"><span className="muted small">Ta progression</span><span className="muted small">{validated} / {core.length} leçons validées</span></div>
        <div className="bar" style={{ marginTop: 6 }}><div style={{ width: `${(validated / core.length) * 100}%` }} /></div>
      </div>

      {def.id === 'exploration' && validated === 0 && !lessons.some(l => store.lessons[l.id]?.defiDone) && (
        <p className="muted small">Pour les joueurs qui connaissent déjà les règles : le vocabulaire de la table en VO, les chiffres qui comptent, la pensée en ranges et les maths du sizing.</p>
      )}

      {resume && (
        <button className="resume" onClick={() => go({ name: 'lecon', id: resume.id })}>
          <div className="k">{resumeP?.defiDone ? `Reprendre · ${PHASE_LABEL[resumeP.lastPhase]}` : validated === 0 ? 'Commencer le parcours' : 'Leçon suivante'}</div>
          <div className="t">{lessonLabel(resume)} · {resume.title}</div>
        </button>
      )}

      {modules.map(m => {
        const ls = lessons.filter(l => l.module === m.id);
        const coreM = ls.filter(l => !l.bonus);
        const v = coreM.filter(l => isValidated(store.lessons[l.id])).length;
        const open = openMods.includes(m.id);
        const allBonus = coreM.length === 0;
        const vb = ls.filter(l => isValidated(store.lessons[l.id])).length;
        const allDone = allBonus ? vb === ls.length : v === coreM.length;
        const started = ls.some(l => store.lessons[l.id]?.defiDone);
        return (
          <div key={m.id} className="module">
            <button className="module-head" onClick={() => toggle(m.id)} aria-expanded={open}>
              <span className={`status-ico ${allDone ? 'ok' : started ? 'on' : ''}`}>{allDone ? '✓' : started ? '◐' : '○'}</span>
              <div className="grow">
                <div className="n">{moduleLabel(m)}</div>
                <div className="t">{m.title}</div>
              </div>
              {allBonus ? <span className="pill">bonus</span> : <span className="muted small">{v}/{coreM.length}</span>}
              <span className="muted">{open ? '▾' : '▸'}</span>
            </button>
            {open && ls.map(l => {
              const pr = store.lessons[l.id];
              const ok = isValidated(pr);
              const inProg = !ok && !!pr?.defiDone;
              return (
                <button key={l.id} className="lesson-row" onClick={() => go({ name: 'lecon', id: l.id })}>
                  <span className={`num ${ok ? 'ok' : inProg ? 'on' : ''}`}>{lessonLabel(l)}</span>
                  <div className="grow">
                    <div className="title">{l.title}{l.bonus && !allBonus && <span className="pill" style={{ marginLeft: 6 }}>bonus</span>}</div>
                    <div className="obj">{l.objective}</div>
                  </div>
                  {ok && <span className="pill ok">{Math.round((pr!.best ?? 0) * 100)} %</span>}
                  {inProg && <span className="pill on">{pr!.best !== null ? `${Math.round(pr!.best * 100)} %` : PHASE_LABEL[pr!.lastPhase]}</span>}
                </button>
              );
            })}
          </div>
        );
      })}

      <Attestation def={def} done={done} validated={validated} />

      {def.id === 'initiation' && initDone && (
        <button className="card tight row" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => { setLastParcours('exploration'); go({ name: 'parcours', p: 'exploration' }); }}>
          <span style={{ fontSize: '1.6rem' }}>🧭</span>
          <span className="small"><strong>Prêt pour la suite ?</strong> Le parcours Exploration t’attend : vocabulaire en VO, chiffres clés, ranges et sizing.</span>
        </button>
      )}

      <p className="muted center small">Ta progression est enregistrée sur cet appareil uniquement.</p>
    </div>
  );
}

function Attestation({ def, done, validated }: { def: ParcoursDef; done: boolean; validated: number }) {
  const [name, setN] = useState(getStore().name ?? '');
  const [busy, setBusy] = useState(false);
  const n = def.core.length;
  const what = def.id === 'exploration' ? 'attestation Exploration PPC' : 'attestation d’initiation PPC';
  if (!done) {
    return (
      <div className="card tight row">
        <span style={{ fontSize: '1.6rem' }}>🎓</span>
        <p className="muted small">Valide les {n} leçons{def.id === 'exploration' ? ' des modules A à D' : ''} pour obtenir ton <strong>{what}</strong> ({validated}/{n}).</p>
      </div>
    );
  }
  const avg = def.core.reduce((a, l) => a + (lessonProgress(l.id).best ?? 0), 0) / n;
  return (
    <div className="card stack">
      <h3>🎓 Bravo, parcours terminé !</h3>
      <p className="muted">Tu as validé les {n} leçons, avec un score moyen de {Math.round(avg * 100)} %. Télécharge ton {what}.</p>
      <input className="search" placeholder="Prénom et nom à inscrire" value={name} onChange={e => setN(e.target.value)} aria-label="Nom sur l’attestation" />
      <button className="btn primary" disabled={busy} onClick={async () => {
        setBusy(true); setName(name.trim());
        try { await (await pdf()).downloadAttestation(name.trim(), avg, def.id); } finally { setBusy(false); }
      }}>⬇ Télécharger mon attestation (PDF)</button>
    </div>
  );
}

// ── Lexique ────────────────────────────────────────────────────────────────

type LexFilter = 'tous' | ParcoursId;

export function Lexique() {
  const store = useStore();
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const [which, setWhich] = useState<LexFilter>(() => (store.lastParcours === 'exploration' ? 'exploration' : 'tous'));
  const unlocked = (lesson: number) => !!store.lessons[lesson]?.bilanSeen;
  const inParcours = (lesson: number) => which === 'tous' || (which === 'exploration' ? lesson > 100 : lesson <= 100);
  const scope = TERMS.filter(t => inParcours(t.lesson));
  const nUnlocked = scope.filter(t => unlocked(t.lesson)).length;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = useMemo(() => scope
    .filter(t => all || unlocked(t.lesson))
    .filter(t => !q || norm(`${t.term} ${t.en ?? ''} ${t.fr ?? ''} ${t.def}`).includes(norm(q)))
    .sort((a, b) => a.term.localeCompare(b.term, 'fr')), [q, all, which, store]);

  return (
    <div className="stack">
      <Header title="Lexique" sub={`${nUnlocked} mot${nUnlocked > 1 ? 's' : ''} découvert${nUnlocked > 1 ? 's' : ''} sur ${scope.length}`} />
      <div className="seg three" role="tablist" aria-label="Filtrer par parcours">
        {(['tous', 'initiation', 'exploration'] as LexFilter[]).map(f => (
          <button key={f} role="tab" aria-selected={which === f} className={which === f ? 'on' : ''} onClick={() => setWhich(f)}>
            {f === 'tous' ? 'Tous' : PARCOURS[f].title}
          </button>
        ))}
      </div>
      <input className="search" placeholder="Chercher un mot (français ou anglais)" value={q} onChange={e => setQ(e.target.value)} aria-label="Chercher dans le lexique" />
      <div className="row">
        <button className={`btn sm ${!all ? 'primary' : ''}`} onClick={() => setAll(false)}>Mes mots ({nUnlocked})</button>
        <button className={`btn sm ${all ? 'primary' : ''}`} onClick={() => setAll(true)}>Tous les mots ({scope.length})</button>
      </div>
      {list.length === 0 && (
        <p className="muted center">{nUnlocked === 0 && !all ? 'Les mots apparaissent ici au fil des bilans.' : 'Aucun mot ne correspond.'}</p>
      )}
      <div>
        {list.map(t => {
          const alt = altOf(t);
          return (
            <div key={t.key} className={`lex-item ${unlocked(t.lesson) ? '' : 'locked'}`}>
              <div><span className="tt">{t.term}</span>{alt && <span className="en">{alt}</span>}</div>
              <div className="small">{t.def}</div>
              <button className="btn ghost sm" style={{ padding: '2px 0', border: 'none', color: 'var(--accent)' }} onClick={() => go({ name: 'lecon', id: t.lesson })}>
                Leçon {labelForId(t.lesson)} · {lessonById(t.lesson)?.title}{unlocked(t.lesson) ? '' : ' (pas encore vue)'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Mes fiches ─────────────────────────────────────────────────────────────

export function Fiches() {
  const store = useStore();
  const [busy, setBusy] = useState<number | string | null>(null);
  const total = ORDER.reduce((a, id) => a + PARCOURS[id].lessons.length, 0);
  const nAvail = ORDER.reduce((a, id) => a + PARCOURS[id].lessons.filter(l => store.lessons[l.id]?.bilanSeen).length, 0);
  const item = (l: Lesson) => ({ lesson: l, moduleTitle: moduleOf(l).title, terms: termsOfLesson(l.id) });
  return (
    <div className="stack">
      <Header title="Mes fiches" sub={`${nAvail} fiche${nAvail > 1 ? 's' : ''} disponible${nAvail > 1 ? 's' : ''} sur ${total}`} />
      <p className="muted small">Une fiche se débloque dès que tu as vu le bilan de sa leçon.</p>
      {ORDER.map(id => {
        const def = PARCOURS[id];
        const avail = def.lessons.filter(l => store.lessons[l.id]?.bilanSeen);
        return (
          <div key={id} className="stack" style={{ gap: 8 }}>
            <h2 style={{ marginTop: 8 }}>{def.title}</h2>
            {avail.length > 1 && (
              <button className="btn primary" disabled={busy !== null} onClick={async () => {
                setBusy(id);
                try { await (await pdf()).downloadAllFiches(avail.map(item), def.id); } finally { setBusy(null); }
              }}>⬇ {busy === id ? 'Préparation…' : `Toutes les fiches ${def.title} en un PDF (${avail.length})`}</button>
            )}
            <div className="module">
              {def.lessons.map(l => {
                const ok = !!store.lessons[l.id]?.bilanSeen;
                return (
                  <div key={l.id} className="lesson-row" style={{ cursor: 'default', opacity: ok ? 1 : 0.5 }}>
                    <span className={`num ${isValidated(store.lessons[l.id]) ? 'ok' : ''}`}>{lessonLabel(l)}</span>
                    <div className="grow">
                      <div className="title">{l.title}</div>
                      <div className="obj">{ok ? `${moduleLabel(moduleOf(l))} · ${moduleOf(l).title}` : 'Disponible après le bilan de la leçon'}</div>
                    </div>
                    {ok
                      ? <button className="btn sm" disabled={busy !== null} onClick={async () => { setBusy(l.id); try { const it = item(l); await (await pdf()).downloadFiche(it.lesson, it.moduleTitle, it.terms); } finally { setBusy(null); } }}>{busy === l.id ? '…' : '⬇ PDF'}</button>
                      : <button className="btn sm ghost" onClick={() => go({ name: 'lecon', id: l.id })}>Ouvrir</button>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
