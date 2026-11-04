'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { IconClose } from '@/components/icons';

export type NoticeState = { tone: 'success' | 'error'; text: string } | null;

export function Notice({ notice, onDismiss }: { notice: NoticeState; onDismiss?: () => void }) {
  if (!notice) return null;
  return (
    <div className={`notice ${notice.tone === 'error' ? 'notice-error' : 'notice-success'}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <span>{notice.text}</span>
      {onDismiss ? (
        <button type="button" className="notice-close" onClick={onDismiss} aria-label="Fermer le message">
          <IconClose width={16} height={16} />
        </button>
      ) : null}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
          {typeof o.count === 'number' ? <span className="segmented-count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function PageHead({ title, intro, children }: { title: string; intro?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="admin-head">
      <div>
        <h1>{title}</h1>
        {intro ? <p className="muted">{intro}</p> : null}
      </div>
      {children ? <div className="admin-head-actions">{children}</div> : null}
    </header>
  );
}

export type ConfirmRequest = {
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'dark' | 'primary';
  /** Ask for a written reason (stored in the immutable moderation log). */
  reason?: { label: string; required: boolean; placeholder?: string; minLength?: number };
  run: (reason: string) => Promise<void>;
};

/**
 * Modal confirmation built on <dialog> (native focus trap + Escape). Errors from `run` are shown
 * inline; the dialog closes only on success.
 */
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const reasonId = useId();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (request && !dlg.open) {
      setReason('');
      setError(null);
      setBusy(false);
      dlg.showModal();
    } else if (!request && dlg.open) {
      dlg.close();
    }
  }, [request]);

  const min = request?.reason?.minLength ?? (request?.reason?.required ? 5 : 0);
  const tooShort = !!request?.reason?.required && reason.trim().length < min;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!request || tooShort) return;
    setBusy(true);
    setError(null);
    try {
      await request.run(reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const toneClass = request?.tone === 'danger' ? 'btn-danger' : request?.tone === 'primary' ? 'btn-primary' : 'btn-dark';

  return (
    <dialog ref={ref} className="admin-dialog" aria-labelledby={titleId} onClose={onClose} onCancel={() => !busy && onClose()}>
      {request ? (
        <form method="dialog" onSubmit={submit}>
          <h2 id={titleId}>{request.title}</h2>
          {request.description ? <div className="admin-dialog-desc">{request.description}</div> : null}
          {request.reason ? (
            <label className="field" htmlFor={reasonId}>
              <span>
                {request.reason.label}
                {request.reason.required ? ' (obligatoire)' : ' (facultatif)'}
              </span>
              <textarea
                id={reasonId}
                rows={4}
                maxLength={1000}
                value={reason}
                placeholder={request.reason.placeholder}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
              {request.reason.required ? (
                <small className="muted">Au moins {min} caractères. Conservé dans le journal de modération.</small>
              ) : null}
            </label>
          ) : null}
          {error ? (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="admin-dialog-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>
              Annuler
            </button>
            <button type="submit" className={`btn btn-sm ${toneClass}`} disabled={busy || tooShort}>
              {busy ? 'En cours…' : request.confirmLabel}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}

export function StateChip({ tone, children }: { tone: 'neutral' | 'warn' | 'ok' | 'danger' | 'info'; children: React.ReactNode }) {
  return <span className={`state-chip state-${tone}`}>{children}</span>;
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <p className="admin-loading muted" role="status">
      {label}
    </p>
  );
}

/**
 * Runs `fetcher` whenever it changes (useCallback deps) and exposes `reload` for event handlers.
 * State is only set from the promise callback, never synchronously inside the effect.
 */
export function useLoader<T>(fetcher: () => Promise<T>): { data: T | null; reload: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    fetcher().then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [fetcher]);
  const reload = useCallback(async () => {
    setData(await fetcher());
  }, [fetcher]);
  return { data, reload };
}
