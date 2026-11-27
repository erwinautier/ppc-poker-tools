/** Briques d'interface : icônes, notifications, confirmations, fenêtres, champs (comme dans Le Club). */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { messageOf } from '../lib/club';
import { chips } from '../lib/format';

const PATHS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  pen: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-7 7-7s7 3 7 7M16 4a4 4 0 0 1 0 7M18 14c3 1 4 4 4 7',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21c0-4.5 3.5-7 8-7s8 2.5 8 7',
  play: 'M7 4l13 8-13 8z',
  pause: 'M8 4v16M16 4v16',
  first: 'M19 5L9 12l10 7zM5 5v14',
  last: 'M5 5l10 7-10 7zM19 5v14',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  undo: 'M4 9h10a6 6 0 0 1 0 12h-3M4 9l5-5M4 9l5 5',
  edit: 'M4 20h4L20 8l-4-4L4 16z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  check: 'M4 12l6 6L20 6',
  close: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l4 2',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v9h14v-9',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  chat: 'M4 5h16v11H9l-5 4z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeoff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.6M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a10 10 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M6 9l6 6 6-6',
  download: 'M12 3v12M8 11l4 4 4-4M4 20h16',
  calc: 'M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01',
  vote: 'M4 13h4v7H4zM10 8h4v12h-4zM16 4h4v16h-4z',
} as const;
export type IconName = keyof typeof PATHS;
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ── Notifications et confirmations ───────────────────────────────────────────
interface ToastItem { id: number; text: string; kind: 'ok' | 'error'; action?: { label: string; run: () => void } }
type ToastFn = (text: string, kind?: 'ok' | 'error', action?: ToastItem['action']) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

interface ConfirmOptions { title: string; text?: ReactNode; ok?: string; danger?: boolean }
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [ask, setAsk] = useState<(ConfirmOptions & { done: (ok: boolean) => void }) | null>(null);
  const seq = useRef(0);
  const toast = useCallback<ToastFn>((text, kind = 'ok', action) => {
    const id = ++seq.current;
    setToasts(l => [...l.filter(t => !t.action).slice(-2), { id, text, kind, action }]);
    setTimeout(() => setToasts(l => l.filter(t => t.id !== id)), action ? 8000 : kind === 'error' ? 6000 : 3000);
  }, []);
  const confirm = useCallback<ConfirmFn>(o => new Promise(done => setAsk({ ...o, done })), []);
  const answer = (ok: boolean) => { ask?.done(ok); setAsk(null); };
  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        {ask && (
          <Modal title={ask.title} onClose={() => answer(false)} small>
            {ask.text && <div className="muted" style={{ marginBottom: 16, fontSize: '.9rem' }}>{ask.text}</div>}
            <div className="row end">
              <button className="btn" onClick={() => answer(false)}>Annuler</button>
              <button className={`btn ${ask.danger ? 'danger' : 'primary'}`} autoFocus onClick={() => answer(true)}>{ask.ok ?? 'Confirmer'}</button>
            </div>
          </Modal>
        )}
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.kind}`}>
              <span>{t.text}</span>
              {t.action && <button className="btn sm" onClick={() => { t.action!.run(); setToasts(l => l.filter(x => x.id !== t.id)); }}>{t.action.label}</button>}
            </div>
          ))}
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

/** Exécute une action, bloque les doubles clics et affiche l'erreur éventuelle. */
export function useAction(): [run: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>, busy: boolean] {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = useCallback(async (fn: () => Promise<unknown>, ok?: string) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok);
      return true;
    } catch (e) {
      toast(messageOf(e), 'error');
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [toast]);
  return [run, busy];
}

export function Modal({ title, onClose, children, small }: { title: string; onClose: () => void; children: ReactNode; small?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && [...document.querySelectorAll('.modal')].at(-1) === ref.current) { e.stopPropagation(); close.current(); }
    };
    document.addEventListener('keydown', on);
    document.body.classList.add('modal-open');
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', on);
      if (document.querySelectorAll('.modal').length <= 1) document.body.classList.remove('modal-open');
      before?.focus?.();
    };
  }, []);
  return (
    <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${small ? 'small' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Fermer"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, wide }: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Montant en jetons : on peut taper « 1 500 », « 1500 » ou « 1,5k » ; vide pendant la saisie. */
export function AmountInput({ value, onChange, min = 0, label, placeholder, autoFocus }: {
  value: number | null; onChange: (v: number | null) => void; min?: number; label?: string; placeholder?: string; autoFocus?: boolean;
}) {
  const show = (v: number | null) => (v === null ? '' : chips(v));
  const [text, setText] = useState(show(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(show(value)); }, [value]);
  return (
    <input
      inputMode="decimal" aria-label={label} placeholder={placeholder} value={text} autoFocus={autoFocus}
      onFocus={e => { focused.current = true; e.currentTarget.select(); }}
      onBlur={() => { focused.current = false; setText(show(value)); }}
      onChange={e => {
        setText(e.target.value);
        const t = e.target.value.trim().toLowerCase().replace(/\s/g, '').replace(',', '.');
        const m = /^(\d+(?:\.\d+)?)(k?)$/.exec(t);
        if (!t) onChange(null);
        else if (m) { const n = Math.round(Number(m[1]) * (m[2] ? 1000 : 1)); onChange(n >= min ? n : null); }
      }}
    />
  );
}

export function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Moins"><Icon name="minus" size={16} /></button>
      <b>{value}</b>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Plus"><Icon name="plus" size={16} /></button>
    </span>
  );
}

/** Pastilles à choix unique (ou multiple). */
export function Chips<T extends string | number>({ items, value, onChange, label, multi, wrap = true }: {
  items: { value: T; label: ReactNode; disabled?: boolean }[]; value: T | T[] | null; onChange: (v: T) => void; label: string; multi?: boolean; wrap?: boolean;
}) {
  const on = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div className={`chips ${wrap ? '' : 'nowrap'}`} role={multi ? 'group' : 'radiogroup'} aria-label={label}>
      {items.map(i => (
        <button key={String(i.value)} type="button" className={`chip ${on(i.value) ? 'on' : ''}`} disabled={i.disabled}
          role={multi ? 'checkbox' : 'radio'} aria-checked={on(i.value)} onClick={() => onChange(i.value)}>
          {i.label}
        </button>
      ))}
    </div>
  );
}
