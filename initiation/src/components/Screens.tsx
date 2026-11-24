import { useMemo, useState } from 'react';
import { CORE_LESSONS, LESSONS, MODULES, lessonById } from '../content';
import { TERMS, termsOfLesson } from '../content/lexique';
import { PHASE_LABEL, getStore, isValidated, lessonProgress, resetAll, setName, useStore } from '../lib/progress';
import { go } from '../lib/router';
const pdf = () => import('../lib/pdf');

const BASE = import.meta.env.BASE_URL;

export function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="header">
      <a href="/" title="Toutes les applications du club"><img src={`${BASE}logo-ppc.jpg`} alt="PPC" /></a>
      <div className="grow">
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
    </div>
  );
}

// ── Parcours ───────────────────────────────────────────────────────────────

export function Parcours() {
  const store = useStore();
  const validated = CORE_LESSONS.filter(l => isValidated(store.lessons[l.id])).length;
  const resume = CORE_LESSONS.find(l => !isValidated(store.lessons[l.id])) ?? LESSONS.find(l => !isValidated(store.lessons[l.id]));
  const resumeP = resume ? lessonProgress(resume.id) : null;
  const [openMods, setOpenMods] = useState<number[]>(() => [resume?.module ?? 1]);
  const toggle = (m: number) => setOpenMods(o => (o.includes(m) ? o.filter(x => x !== m) : [...o, m]));
  const done = validated === CORE_LESSONS.length;

  return (
    <div className="stack">
      <Header title="Initiation" sub="Apprendre le No Limit Hold’em pas à pas" />
      <div>
        <div className="row between"><span className="muted small">Ta progression</span><span className="muted small">{validated} / {CORE_LESSONS.length} leçons validées</span></div>
        <div className="bar" style={{ marginTop: 6 }}><div style={{ width: `${(validated / CORE_LESSONS.length) * 100}%` }} /></div>
      </div>

      {resume && (
        <button className="resume" onClick={() => go({ name: 'lecon', id: resume.id })}>
          <div className="k">{resumeP?.defiDone ? `Reprendre · ${PHASE_LABEL[resumeP.lastPhase]}` : validated === 0 && !resumeP?.defiDone ? 'Commencer le parcours' : 'Leçon suivante'}</div>
          <div className="t">{resume.id} · {resume.title}</div>
        </button>
      )}

      {MODULES.map(m => {
        const ls = LESSONS.filter(l => l.module === m.id);
        const core = ls.filter(l => !l.bonus);
        const v = core.filter(l => isValidated(store.lessons[l.id])).length;
        const open = openMods.includes(m.id);
        const allDone = v === core.length;
        const started = ls.some(l => store.lessons[l.id]?.defiDone);
        return (
          <div key={m.id} className="module">
            <button className="module-head" onClick={() => toggle(m.id)} aria-expanded={open}>
              <span className="status-ico">{allDone ? '✅' : started ? '◐' : '○'}</span>
              <div className="grow">
                <div className="n">Module {m.id}</div>
                <div className="t">{m.title}</div>
              </div>
              <span className="muted small">{v}/{core.length}</span>
              <span className="muted">{open ? '▾' : '▸'}</span>
            </button>
            {open && ls.map(l => {
              const p = store.lessons[l.id];
              const ok = isValidated(p);
              const inProg = !ok && !!p?.defiDone;
              return (
                <button key={l.id} className="lesson-row" onClick={() => go({ name: 'lecon', id: l.id })}>
                  <span className={`num ${ok ? 'ok' : inProg ? 'on' : ''}`}>{l.id}</span>
                  <div className="grow">
                    <div className="title">{l.title}{l.bonus && <span className="pill" style={{ marginLeft: 6 }}>bonus</span>}</div>
                    <div className="obj">{l.objective}</div>
                  </div>
                  {ok && <span className="pill ok">{Math.round((p!.best ?? 0) * 100)} %</span>}
                  {inProg && <span className="pill on">{p!.best !== null ? `${Math.round(p!.best * 100)} %` : PHASE_LABEL[p!.lastPhase]}</span>}
                </button>
              );
            })}
          </div>
        );
      })}

      <Attestation done={done} validated={validated} />

      <p className="muted center small">Ta progression est enregistrée sur cet appareil uniquement.</p>
      <button className="btn ghost sm" style={{ alignSelf: 'center' }} onClick={() => {
        if (confirm('Effacer toute ta progression (défis, scores, fiches débloquées) sur cet appareil ? Cette action est définitive.')) resetAll();
      }}>Remettre ma progression à zéro</button>
    </div>
  );
}

function Attestation({ done, validated }: { done: boolean; validated: number }) {
  const [name, setN] = useState(getStore().name ?? '');
  const [busy, setBusy] = useState(false);
  if (!done) {
    return (
      <div className="card tight row">
        <span style={{ fontSize: '1.6rem' }}>🎓</span>
        <p className="muted small">Valide les {CORE_LESSONS.length} leçons pour obtenir ton <strong>attestation d’initiation PPC</strong> ({validated}/{CORE_LESSONS.length}).</p>
      </div>
    );
  }
  const avg = CORE_LESSONS.reduce((a, l) => a + (lessonProgress(l.id).best ?? 0), 0) / CORE_LESSONS.length;
  return (
    <div className="card stack">
      <h3>🎓 Bravo, parcours terminé !</h3>
      <p className="muted">Tu as validé les {CORE_LESSONS.length} leçons, avec un score moyen de {Math.round(avg * 100)} %. Télécharge ton attestation d’initiation.</p>
      <input className="search" placeholder="Prénom et nom à inscrire" value={name} onChange={e => setN(e.target.value)} aria-label="Nom sur l’attestation" />
      <button className="btn primary" disabled={busy} onClick={async () => {
        setBusy(true); setName(name.trim());
        try { await (await pdf()).downloadAttestation(name.trim(), avg); } finally { setBusy(false); }
      }}>⬇ Télécharger mon attestation (PDF)</button>
    </div>
  );
}

// ── Lexique ────────────────────────────────────────────────────────────────

export function Lexique() {
  const store = useStore();
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const unlocked = (lesson: number) => !!store.lessons[lesson]?.bilanSeen;
  const nUnlocked = TERMS.filter(t => unlocked(t.lesson)).length;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = useMemo(() => TERMS
    .filter(t => all || unlocked(t.lesson))
    .filter(t => !q || norm(`${t.term} ${t.en ?? ''} ${t.def}`).includes(norm(q)))
    .sort((a, b) => a.term.localeCompare(b.term, 'fr')), [q, all, store]);

  return (
    <div className="stack">
      <Header title="Lexique" sub={`${nUnlocked} mot${nUnlocked > 1 ? 's' : ''} découvert${nUnlocked > 1 ? 's' : ''} sur ${TERMS.length}`} />
      <input className="search" placeholder="Chercher un mot (français ou anglais)" value={q} onChange={e => setQ(e.target.value)} aria-label="Chercher dans le lexique" />
      <div className="row">
        <button className={`btn sm ${!all ? 'primary' : ''}`} onClick={() => setAll(false)}>Mes mots ({nUnlocked})</button>
        <button className={`btn sm ${all ? 'primary' : ''}`} onClick={() => setAll(true)}>Tous les mots ({TERMS.length})</button>
      </div>
      {list.length === 0 && (
        <p className="muted center">{nUnlocked === 0 && !all ? 'Les mots apparaissent ici au fil des bilans. Commence la leçon 1 !' : 'Aucun mot ne correspond.'}</p>
      )}
      <div>
        {list.map(t => (
          <div key={t.key} className={`lex-item ${unlocked(t.lesson) ? '' : 'locked'}`}>
            <div><span className="tt">{t.term}</span>{t.en && t.en.toLowerCase() !== t.term.toLowerCase() && <span className="en">{t.en}</span>}</div>
            <div className="small">{t.def}</div>
            <button className="btn ghost sm" style={{ padding: '2px 0', border: 'none', color: 'var(--accent)' }} onClick={() => go({ name: 'lecon', id: t.lesson })}>
              Leçon {t.lesson} · {lessonById(t.lesson)?.title}{unlocked(t.lesson) ? '' : ' (pas encore vue)'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mes fiches ─────────────────────────────────────────────────────────────

export function Fiches() {
  const store = useStore();
  const [busy, setBusy] = useState<number | 'all' | null>(null);
  const avail = LESSONS.filter(l => store.lessons[l.id]?.bilanSeen);
  const modTitle = (id: number) => MODULES.find(m => m.id === id)!.title;
  return (
    <div className="stack">
      <Header title="Mes fiches" sub={`${avail.length} fiche${avail.length > 1 ? 's' : ''} disponible${avail.length > 1 ? 's' : ''} sur ${LESSONS.length}`} />
      <p className="muted small">Une fiche se débloque dès que tu as vu le bilan de sa leçon.</p>
      {avail.length > 1 && (
        <button className="btn primary" disabled={busy !== null} onClick={async () => {
          setBusy('all');
          try { await (await pdf()).downloadAllFiches(avail.map(l => ({ lesson: l, moduleTitle: modTitle(l.module), terms: termsOfLesson(l.id) }))); } finally { setBusy(null); }
        }}>⬇ {busy === 'all' ? 'Préparation…' : `Tout télécharger en un seul PDF (${avail.length})`}</button>
      )}
      <div className="module">
        {LESSONS.map(l => {
          const ok = !!store.lessons[l.id]?.bilanSeen;
          return (
            <div key={l.id} className="lesson-row" style={{ cursor: 'default', opacity: ok ? 1 : 0.5 }}>
              <span className={`num ${isValidated(store.lessons[l.id]) ? 'ok' : ''}`}>{l.id}</span>
              <div className="grow">
                <div className="title">{l.title}</div>
                <div className="obj">{ok ? `Module ${l.module} · ${modTitle(l.module)}` : 'Disponible après le bilan de la leçon'}</div>
              </div>
              {ok
                ? <button className="btn sm" disabled={busy !== null} onClick={async () => { setBusy(l.id); try { await (await pdf()).downloadFiche(l, modTitle(l.module), termsOfLesson(l.id)); } finally { setBusy(null); } }}>{busy === l.id ? '…' : '⬇ PDF'}</button>
                : <button className="btn sm ghost" onClick={() => go({ name: 'lecon', id: l.id })}>Ouvrir</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
