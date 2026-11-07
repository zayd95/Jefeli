/**
 * Voice attachments (W1.2): the recorded clip, its draft form, and its upload. A voice is one
 * optional attachment of a publication (alone, or a narration over photos), a voice status or a
 * chat voice note, never a separate kind of product.
 */
import { Platform } from 'react-native';

import { getBlob, newBlobKey, putBlob } from './blobStore';
import { newObjectPath, uploadWithRetry } from './upload';

export interface NarrationCue {
  /** Milliseconds into the narration. */
  t: number;
  /** Index of the photo shown from then on. */
  i: number;
}

export interface RecordedClip {
  uri: string;
  durationMs: number;
  mimeType: string;
  /** 48 values 0–100, for the waveform shown before anyone listens. */
  waveform: number[];
  cues?: NarrationCue[];
  /** Web only: the recorded bytes (kept for upload and for draft recovery). */
  file?: Blob | null;
}

/** A clip attached to a draft. `blobKey` finds its bytes again after a browser refresh. */
export interface VoiceAttachment extends RecordedClip {
  language?: string | null;
  blobKey?: string | null;
}

export interface UploadedVoice {
  kind: 'audio';
  path: string;
  duration_ms: number;
  waveform: number[] | null;
  language: string | null;
  cues: NarrationCue[] | null;
}

/** Keeps a web recording's bytes with the draft (no-op on native: the file path survives). */
export async function keepForDraft(draftKey: string, clip: RecordedClip): Promise<VoiceAttachment> {
  if (Platform.OS !== 'web' || !clip.file) return { ...clip, file: null };
  const blobKey = newBlobKey(draftKey);
  const ok = await putBlob(blobKey, clip.file);
  return { ...clip, blobKey: ok ? blobKey : null };
}

/**
 * After a restore: on the web, rebuild the clip from IndexedDB (the old blob: URL is dead).
 * Returns null when the bytes are gone; the composer then asks for a new recording.
 */
export async function restoreVoice(voice: VoiceAttachment | null | undefined): Promise<VoiceAttachment | null> {
  if (!voice) return null;
  if (Platform.OS !== 'web') return voice;
  if (!voice.blobKey) return null;
  const blob = await getBlob(voice.blobKey);
  if (!blob) return null;
  return { ...voice, file: blob, uri: URL.createObjectURL(blob) };
}

export async function uploadVoice(
  userId: string,
  voice: VoiceAttachment,
  opts: { bucket: 'public-media' | 'private-media'; folder: string; onProgress?: (f: number) => void; signal?: AbortSignal },
): Promise<UploadedVoice> {
  const path = newObjectPath(userId, opts.folder, voice.mimeType);
  await uploadWithRetry({
    bucket: opts.bucket,
    path,
    uri: voice.uri,
    mimeType: voice.mimeType,
    file: voice.file instanceof Blob ? voice.file : null,
    onProgress: opts.onProgress,
    signal: opts.signal,
  });
  return {
    kind: 'audio',
    path,
    duration_ms: Math.max(1, Math.round(voice.durationMs)),
    waveform: voice.waveform?.length ? voice.waveform : null,
    language: voice.language ?? null,
    cues: voice.cues && voice.cues.length > 1 ? voice.cues : null,
  };
}
