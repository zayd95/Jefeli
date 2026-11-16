'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Round icon action (P2): 44 px minimum, one accessible name, and the same name in a small bubble
 * on a long press (touch) or on focus/hover (the browser's own tooltip). Either a link or, when
 * `share` is given, a button that opens the browser's share sheet or copies the link.
 */
interface Props {
  label: string;
  icon: ReactNode;
  href?: string;
  testId?: string;
  share?: { url: string; title: string; message: string };
}

export function IconAction({ label, icon, href, testId, share }: Props) {
  const [tip, setTip] = useState('');
  const timer = useRef<number | null>(null);
  const hide = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (hide.current) window.clearTimeout(hide.current);
    },
    [],
  );

  const show = (text: string) => {
    setTip(text);
    if (hide.current) window.clearTimeout(hide.current);
    hide.current = window.setTimeout(() => setTip(''), 1600);
  };
  const press = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      timer.current = window.setTimeout(() => show(label), 350);
    },
    onPointerUp: () => timer.current && window.clearTimeout(timer.current),
    onPointerLeave: () => timer.current && window.clearTimeout(timer.current),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  async function onShare() {
    if (!share) return;
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: share.title, text: share.message, url: share.url });
      else {
        await navigator.clipboard.writeText(share.url);
        show('Lien copié');
      }
    } catch {
      /* dismissed */
    }
  }

  const common = { className: 'icon-action', 'aria-label': label, title: label, 'data-testid': testId, ...press };
  return (
    <span className="icon-action-wrap">
      {href ? (
        <a {...common} href={href}>
          {icon}
        </a>
      ) : (
        <button type="button" {...common} onClick={onShare}>
          {icon}
        </button>
      )}
      {tip ? (
        <span className="icon-action-tip" role="status">
          {tip}
        </span>
      ) : null}
    </span>
  );
}
