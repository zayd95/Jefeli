/**
 * Local drafts so a failed or cancelled upload never loses what the member typed.
 */
import { formatDuration } from '@jefeli/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { deleteBlobs } from './blobStore';

export function useDraft<T extends object>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(`draft:${key}`)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          setValue({ ...initial, ...(JSON.parse(raw) as T) });
          setRestored(true);
        } catch {
          /* ignore corrupt draft */
        }
      })
      .finally(() => {
        loaded.current = true;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(`draft:${key}`, JSON.stringify(value)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [key, value]);

  const clear = useCallback(async () => {
    await AsyncStorage.removeItem(`draft:${key}`);
    setValue(initial);
    setRestored(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { value, setValue, restored, clear };
}

// ---------------------------------------------------------------------------
// One draft per kind, never replaced silently (W1.3). The « + » menu and every editor entry point
// look at the draft first: if one exists, the member chooses « Continuer » or « Nouvelle … », and
// starting anew asks before deleting it.
// ---------------------------------------------------------------------------

export type DraftKind = 'post' | 'listing';

/** W1.2 kept article presentations and community requests in their own drafts: adopt them once. */
const LEGACY_POST_KEYS = ['post-present', 'post-seek', 'post-offer', 'post-opinion'];

function excerpt(text: string, n: number): string {
  const t = text.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** What a saved publication draft holds, in a few words (« 4 photos · voix 0:42 »). Null when empty. */
export function describePostDraft(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { body?: string; media?: { kind?: string }[]; voice?: { durationMs?: number } | null; productIds?: string[] };
    const parts: string[] = [];
    const photos = (d.media ?? []).filter((m) => m.kind !== 'video').length;
    const videos = (d.media ?? []).filter((m) => m.kind === 'video').length;
    if (photos) parts.push(`${photos} photo${photos > 1 ? 's' : ''}`);
    if (videos) parts.push(`${videos} vidéo${videos > 1 ? 's' : ''}`);
    if (d.voice?.durationMs) parts.push(`voix ${formatDuration(d.voice.durationMs)}`);
    if (d.productIds?.length) parts.push(`${d.productIds.length} article${d.productIds.length > 1 ? 's' : ''}`);
    const text = (d.body ?? '').trim();
    if (parts.length === 0 && !text) return null;
    if (parts.length === 0) return `« ${excerpt(text, 28)} »`;
    return parts.join(' · ');
  } catch {
    return null;
  }
}

/** « Boubou brodé · 3 photos » for an article draft. Null when nothing was entered. */
export function describeListingDraft(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { title?: string; media?: unknown[]; voice?: { durationMs?: number } | null };
    const title = d.title?.trim();
    const n = d.media?.length ?? 0;
    const parts = [title ? `« ${excerpt(title, 24)} »` : null, n ? `${n} média${n > 1 ? 's' : ''}` : null, d.voice?.durationMs ? `voix ${formatDuration(d.voice.durationMs)}` : null].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  } catch {
    return null;
  }
}

async function adoptLegacyPostDraft(): Promise<void> {
  if (describePostDraft(await AsyncStorage.getItem('draft:post'))) return;
  for (const key of LEGACY_POST_KEYS) {
    const raw = await AsyncStorage.getItem(`draft:${key}`);
    if (describePostDraft(raw)) {
      await AsyncStorage.setItem('draft:post', raw as string);
      await AsyncStorage.removeItem(`draft:${key}`);
      return;
    }
  }
}

/** The summary of the saved draft of this kind, or null when there is none worth keeping. */
export async function readDraftSummary(kind: DraftKind): Promise<string | null> {
  if (kind === 'post') {
    await adoptLegacyPostDraft().catch(() => {});
    return describePostDraft(await AsyncStorage.getItem('draft:post'));
  }
  return describeListingDraft(await AsyncStorage.getItem('draft:listing'));
}

/** Deletes a draft and the files kept with it. Only called after the member confirmed. */
export async function discardDraft(kind: DraftKind): Promise<void> {
  await AsyncStorage.removeItem(`draft:${kind}`);
  await deleteBlobs(kind);
  if (kind === 'post') for (const key of LEGACY_POST_KEYS) await deleteBlobs(key);
}

/**
 * The editor's gate. `decided` comes from the « + » menu (`?draft=continue|new`): the member
 * already chose there. Otherwise, with a draft present, the editor asks before anything else.
 */
export function useDraftGate(kind: DraftKind, decided: string | undefined) {
  const [state, setState] = useState<{ phase: 'checking' | 'ask' | 'ready'; summary: string | null }>({ phase: 'checking', summary: null });
  useEffect(() => {
    let alive = true;
    void readDraftSummary(kind).then((summary) => {
      if (!alive) return;
      setState({ phase: summary && decided !== 'continue' ? 'ask' : 'ready', summary });
    });
    return () => {
      alive = false;
    };
  }, [kind, decided]);
  return {
    phase: state.phase,
    summary: state.summary,
    continueDraft: () => setState((s) => ({ ...s, phase: 'ready' })),
    startNew: async () => {
      await discardDraft(kind);
      setState({ phase: 'ready', summary: null });
    },
  };
}
