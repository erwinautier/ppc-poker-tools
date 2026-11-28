import { useEffect, useMemo, useState } from 'react';
import type { Lesson } from '../content/types';
import { lessonLabel, moduleOf, parcoursOf } from '../content';
import { termsOfLesson } from '../content/lexique';
import { type ItemResult, type Phase, PASS_THRESHOLD, PHASES, PHASE_LABEL, isValidated, lessonProgress, updateLesson, useStore } from '../lib/progress';
import { go } from '../lib/router';
import { Feedback, Runner, type RunResult } from './Runner';
import { ItemView } from './ItemViews';
import { TermPopup } from './Term';
import { FichePreview } from './FichePreview';

export function LessonView({ lesson, phase }: { lesson: Lesson; phase?: Phase }) {
  useStore();
  const p = lessonProgress(lesson.id);
  const requested = phase ?? p.lastPhase ?? 'defi';
  const current: Phase = !p.defiDone && requested !== 'defi' ? 'defi' : requested;
  const [lockMsg, setLockMsg] = useState(false);

  useEffect(() => {
    if (p.lastPhase !== current) updateLesson(lesson.id, { lastPhase: current });
    if (current === 'bilan' && !p.bilanSeen) updateLesson(lesson.id, { bilanSeen: true });
  }, [lesson.id, current, p.lastPhase, p.bilanSeen]);

  const mod = moduleOf(lesson);
  const def = parcoursOf(lesson);
  const total = def.lessons.length;
  const setPhase = (ph: Phase) => {
    if (ph !== 'defi' && !p.defiDone) { setLockMsg(true); return; }
    setLockMsg(false);
    go({ name: 'lecon', id: lesson.id, phase: ph });
  };

  return (
    <div>
      <div className="header">
        <button className="icon-btn" onClick={() => go({ name: 'parcours', p: def.id })} aria-label="Retour au parcours">←</button>
        <div className="grow">
          <div className="lesson-kicker">{def.id === 'exploration' ? 'Exploration · ' : ''}Leçon {lessonLabel(lesson)}{def.id === 'exploration' ? '' : ` / ${total}`}{lesson.bonus ? ' · bonus' : ''} · {mod.title}</div>
          <h1 className="lesson-title">{lesson.title}</h1>
        </div>
        {isValidated(p) && <span className="pill ok">✓ {Math.round((p.best ?? 0) * 100)} %</span>}
      </div>

      <div className="stepper" role="tablist">
        {PHASES.map(ph => {
          const done = ph === 'defi' ? p.defiDone : ph === 'bilan' ? p.bilanSeen : ph === 'entrainement' ? isValidated(p) : false;
          const locked = ph !== 'defi' && !p.defiDone;
          const cls = [ph === current && 'on', ph !== current && done && 'done', locked && 'locked'].filter(Boolean).join(' ');
          return (
            <button key={ph} role="tab" aria-selected={ph === current} className={cls} onClick={() => setPhase(ph)}>
              {locked ? '🔒 ' : done && ph !== current ? '✓ ' : ''}{PHASE_LABEL[ph]}
            </button>
          );
        })}
      </div>
      {lockMsg && !p.defiDone && <p className="feedback neutral mb small">Termine d’abord le défi : c’est en cherchant par toi-même que le bilan prendra tout son sens.</p>}

      {current === 'defi' && <DefiPhase lesson={lesson} />}
      {current === 'bilan' && <BilanPhase lesson={lesson} />}
      {current === 'entrainement' && <TrainingPhase lesson={lesson} />}
      {current === 'fiche' && <FichePhase lesson={lesson} />}
    </div>
  );
}

// ── Défi ───────────────────────────────────────────────────────────────────

function toResults(rs: RunResult[]): ItemResult[] {
  return rs.map(r => ({ id: r.item.id, correct: r.item.silent && r.answer.correct === null ? null : r.answer.correct, answer: r.answer.answer, expected: r.answer.expected, insight: r.item.insight }));
}

function DefiPhase({ lesson }: { lesson: Lesson }) {
  const p = lessonProgress(lesson.id);
  const [run, setRun] = useState(0);
  const items = useMemo(() => (run > 0 ? lesson.defi.items() : []), [run, lesson]);
  if (run > 0) {
    return (
      <Runner key={run} items={items} mode="defi" onFinish={rs => {
        updateLesson(lesson.id, { defiDone: true, defiResults: toResults(rs) });
        go({ name: 'lecon', id: lesson.id, phase: 'bilan' });
      }} />
    );
  }
  return (
    <div className="card stack">
      <span className="pill on" style={{ alignSelf: 'flex-start' }}>Défi · non noté</span>
      <div className="prose">{lesson.defi.intro}</div>
      {p.defiDone ? (
        <>
          <p className="muted">Tu as déjà relevé ce défi. Tu peux le refaire autant de fois que tu veux.</p>
          <div className="row wrap">
            <button className="btn" onClick={() => setRun(1)}>↻ Refaire le défi</button>
            <button className="btn primary" onClick={() => go({ name: 'lecon', id: lesson.id, phase: 'bilan' })}>Voir le bilan →</button>
          </div>
        </>
      ) : (
        <button className="btn primary" onClick={() => setRun(1)}>Commencer le défi</button>
      )}
    </div>
  );
}

// ── Bilan ──────────────────────────────────────────────────────────────────

function BilanPhase({ lesson }: { lesson: Lesson }) {
  const p = lessonProgress(lesson.id);
  const [popup, setPopup] = useState<string | null>(null);
  const shown = p.defiResults.filter(r => r.insight);
  const terms = termsOfLesson(lesson.id);
  return (
    <div className="stack">
      {shown.length > 0 && (
        <div className="card stack">
          <h3>Ce que ton défi a montré</h3>
          <div className="recap">
            {shown.map(r => (
              <div key={r.id} className="recap-line">
                <span className={`m ${r.correct === true ? 'ok' : r.correct === false ? 'ko' : ''}`}>{r.correct === true ? '✓' : r.correct === false ? '✗' : '•'}</span>
                <div>
                  <div>{r.insight}</div>
                  {r.correct === false && <div className="a">Ta réponse : {r.answer}{r.expected ? ` · attendu : ${r.expected}` : ''}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {lesson.bilan.recap?.(p.defiResults)}
      {lesson.bilan.body}
      {terms.length > 0 && (
        <div className="card tight">
          <h3 className="mb">📖 {terms.length} mot{terms.length > 1 ? 's' : ''} ajouté{terms.length > 1 ? 's' : ''} au lexique</h3>
          <div>{terms.map(t => <button key={t.key} className="term-chip" onClick={() => setPopup(t.key)}>{t.term}</button>)}</div>
        </div>
      )}
      {popup && <TermPopup k={popup} onClose={() => setPopup(null)} />}
      <div className="row between wrap">
        <button className="btn ghost" onClick={() => go({ name: 'lecon', id: lesson.id, phase: 'defi' })}>↻ Refaire le défi</button>
        <button className="btn primary" onClick={() => go({ name: 'lecon', id: lesson.id, phase: 'entrainement' })}>S’entraîner →</button>
      </div>
    </div>
  );
}

// ── Entraînement ───────────────────────────────────────────────────────────

function TrainingPhase({ lesson }: { lesson: Lesson }) {
  const p = lessonProgress(lesson.id);
  const [run, setRun] = useState(0);
  const [last, setLast] = useState<{ rs: RunResult[]; seconds: number } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const items = useMemo(() => (run > 0 ? lesson.training.items() : []), [run, lesson]);

  if (run > 0 && !last) {
    return (
      <Runner key={run} items={items} mode="training" timed={lesson.training.timed} onFinish={(rs, seconds) => {
        const graded = rs.filter(r => r.answer.correct !== null);
        const score = graded.length ? graded.filter(r => r.answer.correct).length / graded.length : 1;
        updateLesson(lesson.id, { best: Math.max(p.best ?? 0, score), attempts: p.attempts + 1 });
        setLast({ rs, seconds });
      }} />
    );
  }

  if (last) {
    const graded = last.rs.filter(r => r.answer.correct !== null);
    const ok = graded.filter(r => r.answer.correct).length;
    const pass = graded.length === 0 || ok / graded.length >= PASS_THRESHOLD;
    const need = Math.ceil(graded.length * PASS_THRESHOLD);
    const errors = last.rs.map((r, i) => ({ r, i })).filter(x => x.r.answer.correct === false);
    return (
      <div className="stack">
        <div className="card stack">
          <div className="row" style={{ gap: 14 }}>
            <div className="chip-big">{ok} / {graded.length}</div>
            <div>
              {pass ? <span className="pill ok">✓ Leçon validée</span> : <span className="pill ko">Pas encore validée</span>}
              <div className="muted small" style={{ marginTop: 4 }}>
                Seuil : {need} / {graded.length}{lesson.training.timed ? ` · ${last.seconds} s` : ''} · meilleur score : {Math.round((lessonProgress(lesson.id).best ?? 0) * 100)} %
              </div>
            </div>
          </div>
          {!pass && <p className="muted">Relis le bilan si besoin, puis retente ta chance : les exercices changent à chaque fois.</p>}
        </div>
        {errors.length > 0 && (
          <div className="card stack">
            <h3>Tes erreurs</h3>
            {errors.map(({ r, i }) => (
              <div key={i} className="stack" style={{ gap: 8 }}>
                <button className="opt" onClick={() => setOpen(open === i ? null : i)}>
                  <span style={{ color: 'var(--danger)', fontWeight: 800 }}>✗</span> Exercice {i + 1} · <span style={{ color: 'var(--accent)' }}>{open === i ? 'Masquer' : 'Revoir'}</span>
                </button>
                {open === i && (
                  <div className="scene stack">
                    <div className="prompt">{r.item.prompt}</div>
                    {r.item.scene}
                    <ItemView item={r.item} result={r.answer} onAnswer={() => {}} />
                    <Feedback item={r.item} res={r.answer} mode="training" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="row between wrap">
          <button className="btn" onClick={() => { setLast(null); setOpen(null); setRun(run + 1); }}>↻ Nouvel entraînement</button>
          <button className="btn primary" onClick={() => go({ name: 'lecon', id: lesson.id, phase: 'fiche' })}>Ma fiche →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card stack">
      <span className="pill on" style={{ alignSelf: 'flex-start' }}>Entraînement · noté</span>
      <div className="prose">{lesson.training.intro ?? <p>À toi de jouer, avec correction après chaque exercice. Il faut 70 % de bonnes réponses pour valider la leçon. Les exercices changent à chaque tentative.</p>}</div>
      {p.best !== null && <p className="muted">Meilleur score : {Math.round(p.best * 100)} % · {p.attempts} tentative{p.attempts > 1 ? 's' : ''}</p>}
      <button className="btn primary" onClick={() => setRun(run + 1)}>{p.attempts ? 'Nouvel entraînement' : 'Commencer l’entraînement'}</button>
    </div>
  );
}

// ── Fiche ──────────────────────────────────────────────────────────────────

function FichePhase({ lesson }: { lesson: Lesson }) {
  const [busy, setBusy] = useState(false);
  const mod = moduleOf(lesson);
  const def = parcoursOf(lesson);
  const idx = def.lessons.findIndex(l => l.id === lesson.id);
  const next = def.lessons[idx + 1];
  const p = lessonProgress(lesson.id);
  return (
    <div className="stack">
      <FichePreview lesson={lesson} />
      <button className="btn primary block" disabled={busy} onClick={async () => {
        setBusy(true);
        try { const { downloadFiche } = await import('../lib/pdf'); await downloadFiche(lesson, mod.title, termsOfLesson(lesson.id)); } finally { setBusy(false); }
      }}>⬇ {busy ? 'Préparation…' : 'Télécharger la fiche (PDF)'}</button>
      {!isValidated(p) && <p className="muted small center">Pense à valider la leçon à l’entraînement (70 %).</p>}
      <div className="row between wrap">
        <button className="btn ghost" onClick={() => go({ name: 'lecon', id: lesson.id, phase: 'entrainement' })}>↻ Entraînement</button>
        {next
          ? <button className="btn" onClick={() => go({ name: 'lecon', id: next.id })}>Leçon {lessonLabel(next)} : {next.title} →</button>
          : <button className="btn" onClick={() => go({ name: 'parcours', p: def.id })}>Retour au parcours</button>}
      </div>
    </div>
  );
}
