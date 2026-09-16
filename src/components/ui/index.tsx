import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconAlert, IconCheckCircle, IconInfo, IconStar, IconX } from './Icons';

/* ========================================================================== */
/* Avatar                                                                      */
/* ========================================================================== */

export function Avatar({
  name,
  color,
  size = 'md',
  square = false,
}: {
  name: string;
  color: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  square?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter((w) => w && w.toLowerCase() !== 'the' && w.toLowerCase() !== 'family')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      className={`avatar avatar-${size}${square ? ' avatar-square' : ''}`}
      style={{ background: color }}
      aria-hidden="true"
    >
      {initials || '?'}
    </div>
  );
}

/* ========================================================================== */
/* Badges                                                                      */
/* ========================================================================== */

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'ok' | 'pending' | 'warn' | 'neutral' | 'brand' | 'info' | 'accent';
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/* ========================================================================== */
/* Importance / enthusiasm stars                                               */
/* ========================================================================== */

/**
 * The importance control.
 *
 * Interactive version is a radiogroup, not five buttons — so a keyboard user sets a
 * value with arrow keys the way they would any rating, and a screen reader announces
 * "Important, 3 of 5" rather than "star button".
 */
export function Stars({
  value,
  onChange,
  max = 5,
  size = 'md',
  label,
  labels,
}: {
  value: number;
  onChange?: (v: 1 | 2 | 3 | 4 | 5) => void;
  max?: number;
  size?: 'sm' | 'md' | 'readonly';
  label?: string;
  labels?: Record<number, string>;
}) {
  const readonly = !onChange;
  const cls = size === 'readonly' ? 'stars stars-readonly' : size === 'sm' ? 'stars stars-sm' : 'stars';

  if (readonly) {
    return (
      <span className={cls} role="img" aria-label={`${value} out of ${max}${label ? ` — ${label}` : ''}`}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className="star" data-filled={i < value}>
            <IconStar filled={i < value} size={size === 'readonly' ? 11 : 14} />
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className={cls} role="radiogroup" aria-label={label ?? 'Importance'}>
      {Array.from({ length: max }, (_, i) => {
        const v = (i + 1) as 1 | 2 | 3 | 4 | 5;
        const title = labels?.[v] ?? `${v} of ${max}`;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={title}
            title={title}
            className="star"
            data-filled={i < value}
            onClick={() => onChange(v)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                onChange(Math.min(max, value + 1) as 1 | 2 | 3 | 4 | 5);
              }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange(Math.max(1, value - 1) as 1 | 2 | 3 | 4 | 5);
              }
            }}
          >
            <IconStar filled={i < value} size={16} />
          </button>
        );
      })}
    </span>
  );
}

/* ========================================================================== */
/* Alerts                                                                      */
/* ========================================================================== */

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'ok' | 'warn' | 'danger' | 'brand';
  title?: string;
  children?: ReactNode;
}) {
  const Icon = tone === 'ok' ? IconCheckCircle : tone === 'info' || tone === 'brand' ? IconInfo : IconAlert;
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <span className="alert-icon">
        <Icon size={17} />
      </span>
      <div>
        {title && <strong style={{ display: 'block', marginBottom: children ? 2 : 0 }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

/**
 * The prototype disclosure.
 *
 * Used wherever the prototype simulates something real — verification above all. The
 * brief is explicit: do not pretend mock verification is real verification. This
 * component makes that impossible to do by accident, because every simulated surface
 * renders one.
 */
export function PrototypeNote({ children }: { children: ReactNode }) {
  return (
    <div className="proto-note">
      <IconInfo size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>Prototype</strong> — {children}
      </div>
    </div>
  );
}

export function SafetyNote({ children }: { children: ReactNode }) {
  return (
    <div className="safety-note">
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        <IconCheckCircle size={16} />
      </span>
      <div>{children}</div>
    </div>
  );
}

/* ========================================================================== */
/* Modal                                                                       */
/* ========================================================================== */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Focus trap: a modal that leaks focus to the page behind it is a broken dialog.
      if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      ref.current?.querySelector<HTMLElement>('button, input, textarea, select, a[href]')?.focus();
    }, 40);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.clearTimeout(t);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
      >
        <div className="modal-header">
          <div>
            <h2 id={titleId} style={{ fontSize: 'var(--text-lg)' }}>
              {title}
            </h2>
            {description && (
              <p className="small muted" style={{ marginTop: 4 }}>
                {description}
              </p>
            )}
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Toasts                                                                      */
/* ========================================================================== */

interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'ok' | 'error';
}

const ToastContext = createContext<{ push: (message: string, tone?: Toast['tone']) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);

  const push = useCallback((message: string, tone: Toast['tone'] = 'default') => {
    next.current += 1;
    const id = next.current;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Polite live region: announced to screen readers without interrupting. */}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.tone === 'ok' ? ' toast-ok' : t.tone === 'error' ? ' toast-error' : ''}`}>
            {t.tone === 'ok' && <IconCheckCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />}
            {t.tone === 'error' && <IconAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ========================================================================== */
/* Form primitives                                                             */
/* ========================================================================== */

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  optional,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
        {optional && <span className="muted" style={{ fontWeight: 400 }}> — optional</span>}
      </label>
      {hint && <div className="hint">{hint}</div>}
      {children}
      {error && (
        <div className="error-text" role="alert">
          <IconAlert size={13} />
          {error}
        </div>
      )}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}) {
  const generated = useId();
  const switchId = id ?? generated;
  return (
    <div className="row row-4 row-between" style={{ gap: 'var(--sp-5)' }}>
      <label htmlFor={switchId} style={{ cursor: 'pointer' }}>
        <div className="strong" style={{ fontSize: 'var(--text-base)' }}>
          {label}
        </div>
        {description && <div className="small muted">{description}</div>}
      </label>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch"
        onClick={() => onChange(!checked)}
      >
        <span className="switch-track" data-on={checked}>
          <span className="switch-thumb" />
        </span>
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ========================================================================== */
/* Loading & empty states                                                      */
/* ========================================================================== */

export function Spinner({ large }: { large?: boolean }) {
  return <span className={`spinner${large ? ' spinner-lg' : ''}`} role="status" aria-label="Loading" />;
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="empty-state" role="status">
      <Spinner large />
      <p className="muted small" style={{ marginTop: 'var(--sp-3)' }}>
        {label}
      </p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h3 style={{ fontSize: 'var(--text-md)' }}>{title}</h3>
      {description && (
        <p className="muted" style={{ maxWidth: '44ch' }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 'var(--sp-3)' }}>{action}</div>}
    </div>
  );
}

/* ========================================================================== */
/* Tabs                                                                        */
/* ========================================================================== */

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: Array<{ value: T; label: string; count?: number }>;
  label?: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          className="tab"
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="badge badge-neutral" style={{ marginLeft: 6 }}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
