import { useState, type ReactNode } from 'react';
import { TERM_BY_KEY } from '../content/lexique';
import { labelForId } from '../content/labels';

/** Mot du lexique, souligné en pointillés : un toucher affiche sa définition. */
export function T({ k, children }: { k: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = TERM_BY_KEY[k];
  if (!t) return <>{children}</>;
  return (
    <>
      <span className="term" role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={e => e.key === 'Enter' && setOpen(true)}>
        {children ?? t.term.toLowerCase()}
      </span>
      {open && <TermPopup k={k} onClose={() => setOpen(false)} />}
    </>
  );
}

export function TermPopup({ k, onClose }: { k: string; onClose: () => void }) {
  const t = TERM_BY_KEY[k];
  if (!t) return null;
  return (
    <div className="pop-bg" onClick={onClose}>
      <div className="pop" onClick={e => e.stopPropagation()} role="dialog" aria-label={t.term}>
        <div className="row between">
          <div>
            <div className="tt">{t.term}</div>
            {t.fr ? <div className="en">En français : {t.fr}</div> : t.en && <div className="en">En anglais : {t.en}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <p style={{ marginTop: 8 }}>{t.def}</p>
        <p className="muted" style={{ marginTop: 8 }}>Introduit en leçon {labelForId(t.lesson)}</p>
      </div>
    </div>
  );
}
