import type { FicheBlock, Lesson } from '../content/types';
import { termsOfLesson } from '../content/lexique';
import { CardRow } from './Cards';

function Block({ b }: { b: FicheBlock }) {
  return (
    <>
      {b.title && <h3>{b.title}</h3>}
      {b.kind === 'text' && <p>{b.text}</p>}
      {b.kind === 'steps' && <ol style={{ paddingLeft: 18 }}>{b.steps.map(s => <li key={s}>{s}</li>)}</ol>}
      {b.kind === 'cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {b.rows.map(r => (
            <div key={r.label + r.cards} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ minWidth: 110, fontSize: '0.8rem' }}>{r.label}</strong>
              <div style={{ display: 'flex' }}><CardRow cs={r.cards} size="xs" gap={2} /></div>
              {r.note && <span style={{ fontSize: '0.75rem', color: '#7d5a74' }}>{r.note}</span>}
            </div>
          ))}
        </div>
      )}
      {b.kind === 'table' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: '0.78rem' }}>
            <thead><tr>{b.head.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Aperçu à l'écran de la fiche PDF. */
export function FichePreview({ lesson }: { lesson: Lesson }) {
  const f = lesson.fiche;
  const terms = termsOfLesson(lesson.id);
  return (
    <div className="fiche-sheet">
      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7d5a74', letterSpacing: '.05em' }}>FICHE DE SYNTHÈSE · LEÇON {lesson.id}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, margin: '2px 0 8px' }}>{lesson.title}</div>
      <h3>L’essentiel</h3>
      <ul>{f.essentiel.map(e => <li key={e}>{e}</li>)}</ul>
      {f.blocks?.slice(0, lesson.id === 19 ? 2 : undefined).map((b, i) => <Block key={i} b={b} />)}
      {lesson.id === 19 && <p style={{ fontSize: '0.75rem', color: '#7d5a74', marginTop: 6 }}>… et tous les autres thèmes dans le PDF.</p>}
      {f.pieges && f.pieges.length > 0 && (<><h3>Pièges à éviter</h3><ul>{f.pieges.map(p => <li key={p}>{p}</li>)}</ul></>)}
      {terms.length > 0 && lesson.id !== 19 && (
        <>
          <h3>Les mots de la leçon</h3>
          <ul>{terms.map(t => <li key={t.key}><strong>{t.term}</strong>{t.en && t.en.toLowerCase() !== t.term.toLowerCase() ? ` (${t.en})` : ''} : {t.def}</li>)}</ul>
        </>
      )}
    </div>
  );
}
