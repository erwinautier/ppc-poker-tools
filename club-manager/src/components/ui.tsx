import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import qrcode from 'qrcode-generator';
import { messageOf } from '../lib/api';

// ── Icônes (tracé simple, 24 x 24) ───────────────────────────────────────────
const PATHS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M9 21c0-2 1-4 3-4s3 2 3 4',
  calendar: 'M4 6h16v15H4zM4 11h16M8 3v5M16 3v5',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-7 7-7s7 3 7 7M16 4a4 4 0 0 1 0 7M18 14c3 1 4 4 4 7',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21c0-4.5 3.5-7 8-7s8 2.500 8 7',
  play: 'M7 4l13 8-13 8z',
  pause: 'M8 4v16M16 4v16',
  prev: 'M19 5L9 12l10 7zM5 5v14',
  next: 'M5 5l10 7-10 7zM19 5v14',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  sound: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11',
  mute: 'M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  skull: 'M5 11a7 7 0 1 1 14 0c0 2.500-1 4-2.500 5v3h-9v-3C6 15 5 13.500 5 11zM9 11h.01M15 11h.01M10.500 19v2M13.500 19v2',
  undo: 'M4 9h10a6 6 0 0 1 0 12h-3M4 9l5-5M4 9l5 5',
  edit: 'M4 20h4L20 8l-4-4L4 16z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  check: 'M4 12l6 6L20 6',
  close: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l4 2',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v9h14v-9',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  dice: 'M4 4h16v16H4zM8.500 8.500h.01M15.500 8.500h.01M12 12h.01M8.500 15.500h.01M15.500 15.500h.01',
  back: 'M15 5l-7 7 7 7',
  download: 'M12 3v12M8 11l4 4 4-4M4 20h16',
  swap: 'M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7',
} as const;
export type IconName = keyof typeof PATHS;
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ── Notifications ────────────────────────────────────────────────────────────
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
    // Un seul « Annuler » à l'écran : celui de la dernière action.
    setToasts(l => [...l.filter(t => !t.action).slice(-2), { id, text, kind, action }]);
    setTimeout(() => setToasts(l => l.filter(t => t.id !== id)), action ? 8000 : kind === 'error' ? 6000 : 3500);
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
              {t.action && (
                <button className="btn sm" onClick={() => { t.action!.run(); setToasts(l => l.filter(x => x.id !== t.id)); }}>{t.action.label}</button>
              )}
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

// ── Fenêtre ──────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, small, wide }: { title: string; onClose: () => void; children: ReactNode; small?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
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
      <div className={`modal ${small ? 'small' : ''} ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Fermer"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Champs ───────────────────────────────────────────────────────────────────
export function Field({ label, hint, children, wide }: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Champ numérique que l'on peut vider pendant la saisie. */
export function NumberInput({ value, onChange, min = 0, max, step = 1, placeholder, label, width }: {
  value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; placeholder?: string; label?: string; width?: number;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value === null ? '' : String(value)); }, [value]);
  return (
    <input
      type="number" inputMode={Number.isInteger(step) && min >= 0 ? 'numeric' : 'decimal'} min={min} max={max} step={step} value={text} placeholder={placeholder}
      aria-label={label} style={width ? { width } : undefined}
      onFocus={() => { focused.current = true; }}
      onChange={e => {
        setText(e.target.value);
        const n = Number(e.target.value.replace(',', '.'));
        if (e.target.value === '') onChange(null);
        else if (Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onChange(n);
      }}
      onBlur={() => { focused.current = false; setText(value === null ? '' : String(value)); }}
    />
  );
}

export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      <span className="switch-text">{label}{hint && <small>{hint}</small>}</span>
    </label>
  );
}

export function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="choice" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          <b>{o.label}</b>
          {o.hint && <span>{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, label, disabled }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; disabled?: boolean }) {
  return (
    <span className="stepper" aria-label={label}>
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label={`${label} : retirer`}><Icon name="minus" size={14} /></button>
      <b>{value}</b>
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label={`${label} : ajouter`}><Icon name="plus" size={14} /></button>
    </span>
  );
}

// ── États ────────────────────────────────────────────────────────────────────
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><b>{title}</b>{children && <div>{children}</div>}</div>;
}
export function Loading() {
  return <div className="loading" role="status"><span /><span /><span /><em>Chargement</em></div>;
}
export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="errorbox">
      <span>{text}</span>
      {onRetry && <button className="btn sm" onClick={onRetry}>Réessayer</button>}
    </div>
  );
}
export function State({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  if (error) return <ErrorBox text={error} onRetry={onRetry} />;
  if (loading) return <Loading />;
  return null;
}

// ── QR code ──────────────────────────────────────────────────────────────────
export function Qr({ text, size = 160 }: { text: string; size?: number }) {
  const { path, n } = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const count = q.getModuleCount();
    let p = '';
    for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (q.isDark(y, x)) p += `M${x} ${y}h1v1h-1z`;
    return { path: p, n: count };
  }, [text]);
  return (
    <svg className="qr" width={size} height={size} viewBox={`-2 -2 ${n + 4} ${n + 4}`} shapeRendering="crispEdges" role="img" aria-label="QR code du tournoi">
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#FFF2DC" />
      <path d={path} fill="#26082D" />
    </svg>
  );
}

/** Jeton de couleur : chiffre lisible sur clair comme sur sombre. */
export function ChipDot({ color, size = 18 }: { color: string; size?: number }) {
  return <span className="chipdot" style={{ background: color, width: size, height: size }} aria-hidden="true" />;
}
