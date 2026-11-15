/**
 * Media pipeline: pick -> compress -> upload with progress, retry with backoff, cancel.
 *
 * Uploads go straight to Supabase Storage under `{userId}/...` (storage RLS enforces the
 * folder). The database later verifies the object exists AND belongs to the caller before
 * it can be referenced by a post, listing, status or message.
 */
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';

import { env } from './env';
import { supabase } from './supabase';

export type MediaKind = 'image' | 'video';

export interface LocalMedia {
  uri: string;
  kind: MediaKind;
  width: number;
  height: number;
  durationMs?: number | null;
  mimeType: string;
  fileSize?: number | null;
  /** Web only: the original File from the picker. */
  file?: Blob | null;
  /** Web only: a poster frame captured in the browser before upload (native uses expo-video-thumbnails). */
  posterFile?: Blob | null;
  /** Web only: an object URL of `posterFile`, to preview the cover frame in the composer. */
  posterUri?: string | null;
  /** Web only: where a draft keeps this file's bytes (IndexedDB), to survive a refresh (W1.2). */
  blobKey?: string | null;
}

export interface UploadedMedia {
  kind: MediaKind;
  path: string;
  poster_path?: string | null;
  width: number;
  height: number;
  duration_ms?: number | null;
}

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly code: 'too_large' | 'network' | 'server' | 'canceled' | 'unsupported' | 'permission' | 'quota',
  ) {
    super(message);
  }
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
/** Same limit in publications, listings and statuses; enforced again by the database (≤ 180 000 ms). */
export const MAX_VIDEO_SECONDS = 180;
const MAX_IMAGE_EDGE = 1600;

// ---------------------------------------------------------------------------
// Picking
// ---------------------------------------------------------------------------

export async function pickMedia(opts: {
  allowVideo?: boolean;
  multiple?: boolean;
  limit?: number;
  camera?: boolean;
}): Promise<LocalMedia[] | null> {
  const mediaTypes: ImagePicker.MediaType[] = opts.allowVideo ? ['images', 'videos'] : ['images'];
  const common: ImagePicker.ImagePickerOptions = {
    mediaTypes,
    quality: 0.85,
    videoMaxDuration: MAX_VIDEO_SECONDS,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    allowsMultipleSelection: !opts.camera && !!opts.multiple,
    selectionLimit: opts.limit ?? 10,
    exif: false,
  };

  if (opts.camera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new UploadError('camera_denied', 'permission');
  } else if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new UploadError('library_denied', 'permission');
  }

  const res = opts.camera ? await ImagePicker.launchCameraAsync(common) : await ImagePicker.launchImageLibraryAsync(common);
  if (res.canceled) return null;

  const picked = res.assets.map((a) => {
    const kind: MediaKind = a.type === 'video' ? 'video' : 'image';
    return {
      uri: a.uri,
      kind,
      width: a.width || 1080,
      height: a.height || 1080,
      // expo-image-picker reports milliseconds on iOS/Android but seconds on the web
      // (HTMLVideoElement.duration); 0 when the browser cannot read the file.
      durationMs: a.duration ? (Platform.OS === 'web' ? a.duration * 1000 : a.duration) : null,
      mimeType: a.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      fileSize: a.fileSize ?? a.file?.size ?? null,
      file: a.file ?? null,
    } satisfies LocalMedia;
  });
  const checked = await Promise.all(picked.map((m) => (Platform.OS === 'web' && m.kind === 'video' ? probeWebVideo(m) : m)));
  for (const m of checked) assertMediaLimits(m);
  return checked;
}

/** Duration and size limits, checked as soon as a file is chosen (and again before upload). */
export function assertMediaLimits(m: LocalMedia): void {
  if (m.fileSize && m.fileSize > MAX_UPLOAD_BYTES) throw new UploadError(m.kind === 'video' ? 'video_too_heavy' : 'too_large', 'too_large');
  if (m.kind === 'video' && m.durationMs && m.durationMs > MAX_VIDEO_SECONDS * 1000 + 500) throw new UploadError('too_long', 'too_large');
}

/**
 * Web: read a chosen video's real duration and size with the browser's own decoder, and capture a
 * poster frame (JPEG, longest edge 720 px). A format the browser cannot decode keeps the picker's
 * values and gets no poster; the database still requires a declared duration for videos.
 */
async function probeWebVideo(m: LocalMedia): Promise<LocalMedia> {
  if (typeof document === 'undefined') return m;
  const src = m.file ? URL.createObjectURL(m.file) : m.uri;
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  const once = (event: string, ms = 10_000) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout:${event}`)), ms);
      video.addEventListener(event, () => (clearTimeout(timer), resolve()), { once: true });
      video.addEventListener('error', () => (clearTimeout(timer), reject(new Error('decode'))), { once: true });
    });
  try {
    video.src = src;
    await once('loadedmetadata');
    const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : m.durationMs ?? null;
    const width = video.videoWidth || m.width;
    const height = video.videoHeight || m.height;
    let posterFile: Blob | null = null;
    try {
      video.currentTime = Math.min(0.4, (video.duration || 1) / 2);
      await once('seeked', 5000);
      const scale = Math.min(1, 720 / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      posterFile = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.75));
    } catch {
      posterFile = null;
    }
    return { ...m, durationMs, width, height, posterFile, posterUri: posterFile ? URL.createObjectURL(posterFile) : null };
  } catch {
    return m;
  } finally {
    video.removeAttribute('src');
    video.load();
    if (m.file) URL.revokeObjectURL(src);
  }
}

// ---------------------------------------------------------------------------
// Compression (images re-encoded to JPEG, longest edge <= 1600px)
// ---------------------------------------------------------------------------

export async function compressImage(media: LocalMedia): Promise<LocalMedia> {
  if (media.kind !== 'image') return media;
  try {
    const longest = Math.max(media.width, media.height);
    const ctx = ImageManipulator.manipulate(media.uri);
    if (longest > MAX_IMAGE_EDGE) {
      if (media.width >= media.height) ctx.resize({ width: MAX_IMAGE_EDGE });
      else ctx.resize({ height: MAX_IMAGE_EDGE });
    }
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: 0.78, format: SaveFormat.JPEG });
    return { ...media, uri: out.uri, width: out.width, height: out.height, mimeType: 'image/jpeg', file: null, fileSize: null };
  } catch {
    // Compression is an optimisation; fall back to the original file.
    return media;
  }
}

async function videoPoster(media: LocalMedia): Promise<LocalMedia | null> {
  if (media.kind !== 'video') return null;
  if (Platform.OS === 'web') {
    // A draft restored from JSON holds `{}` where the Blob was: only a real Blob is a poster.
    return media.posterFile instanceof Blob ? { uri: '', kind: 'image', width: media.width, height: media.height, mimeType: 'image/jpeg', file: media.posterFile } : null;
  }
  try {
    const thumb = await VideoThumbnails.getThumbnailAsync(media.uri, { time: 400, quality: 0.7 });
    return { uri: thumb.uri, kind: 'image', width: thumb.width, height: thumb.height, mimeType: 'image/jpeg' };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Upload (XHR for progress + abort; retries on network/5xx)
// ---------------------------------------------------------------------------

function extFor(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('webm')) return mime.startsWith('audio') ? 'webm' : 'webm';
  if (mime.includes('mp4') && mime.startsWith('audio')) return 'm4a';
  if (mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.startsWith('video')) return 'mp4';
  return 'jpg';
}

/**
 * RFC 4122 v4 UUID built from getRandomValues. Browsers only expose crypto.randomUUID on secure
 * origins (https or localhost), so an iPhone opening the dev server over Wi-Fi
 * (http://192.168.x.x:8081) could not upload anything. getRandomValues is available everywhere.
 */
function uuidV4(): string {
  const b = Crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function newObjectPath(userId: string, folder: string, mime: string): string {
  return `${userId}/${folder}/${uuidV4()}.${extFor(mime)}`;
}

interface UploadArgs {
  bucket: 'avatars' | 'public-media' | 'private-media';
  path: string;
  uri: string;
  mimeType: string;
  file?: Blob | null;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

async function bodyFor(args: UploadArgs): Promise<Blob | FormData> {
  if (Platform.OS === 'web') {
    if (args.file) return args.file;
    const res = await fetch(args.uri);
    return await res.blob();
  }
  // React Native streams the file from disk when given { uri, name, type } in FormData.
  const form = new FormData();
  form.append('cacheControl', '31536000');
  form.append('', { uri: args.uri, name: args.path.split('/').pop() ?? 'file', type: args.mimeType } as unknown as Blob);
  return form;
}

function uploadOnce(args: UploadArgs, token: string, body: Blob | FormData): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${env.supabaseUrl}/storage/v1/object/${args.bucket}/${args.path.split('/').map(encodeURIComponent).join('/')}`;
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', env.supabaseKey);
    xhr.setRequestHeader('x-upsert', 'false');
    if (!(body instanceof FormData)) {
      xhr.setRequestHeader('Content-Type', args.mimeType);
      xhr.setRequestHeader('cache-control', 'max-age=31536000');
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && args.onProgress) args.onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 413) reject(new UploadError('too_large', 'too_large'));
      // Storage answers 403 « row-level security » once the member's upload quota is used up.
      else if (xhr.status === 403 && /row-level security/i.test(xhr.responseText)) reject(new UploadError('quota', 'quota'));
      else if (xhr.status >= 500) reject(new UploadError(`server_${xhr.status}`, 'server'));
      else if (xhr.status === 415 || xhr.status === 400) reject(new UploadError(xhr.responseText || 'unsupported', 'unsupported'));
      else reject(new UploadError(xhr.responseText || `http_${xhr.status}`, 'server'));
    };
    xhr.onerror = () => reject(new UploadError('network', 'network'));
    xhr.ontimeout = () => reject(new UploadError('network', 'network'));
    xhr.timeout = 5 * 60 * 1000;
    if (args.signal) {
      if (args.signal.aborted) {
        reject(new UploadError('canceled', 'canceled'));
        return;
      }
      args.signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new UploadError('canceled', 'canceled'));
      });
    }
    xhr.send(body);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function uploadWithRetry(args: UploadArgs, attempts = 4): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new UploadError('not_authenticated', 'permission');
    try {
      const body = await bodyFor(args);
      await uploadOnce(args, token, body);
      return;
    } catch (e) {
      lastErr = e;
      if (e instanceof UploadError && (e.code === 'canceled' || e.code === 'too_large' || e.code === 'unsupported' || e.code === 'quota')) throw e;
      if (i < attempts - 1) await sleep(1000 * 2 ** i);
    }
  }
  throw lastErr;
}

/**
 * Compress + upload a batch of media; reports aggregate progress (0..1).
 * Videos also get a poster frame (native only).
 */
export async function uploadMediaBatch(
  userId: string,
  items: LocalMedia[],
  opts: { bucket: 'public-media' | 'private-media'; folder: string; onProgress?: (f: number) => void; signal?: AbortSignal },
): Promise<UploadedMedia[]> {
  const prepared = await Promise.all(items.map((m) => compressImage(m)));
  for (const m of prepared) assertMediaLimits(m);
  const fractions = prepared.map(() => 0);
  const report = () => opts.onProgress?.(fractions.reduce((a, b) => a + b, 0) / Math.max(1, fractions.length));

  const results: UploadedMedia[] = [];
  for (let i = 0; i < prepared.length; i++) {
    const m = prepared[i] as LocalMedia;
    const path = newObjectPath(userId, opts.folder, m.mimeType);
    let posterPath: string | null = null;
    const poster = await videoPoster(m);
    if (poster) {
      posterPath = newObjectPath(userId, opts.folder, 'image/jpeg');
      await uploadWithRetry({ bucket: opts.bucket, path: posterPath, uri: poster.uri, mimeType: 'image/jpeg', file: poster.file, signal: opts.signal });
    }
    await uploadWithRetry({
      bucket: opts.bucket,
      path,
      uri: m.uri,
      mimeType: m.mimeType,
      file: m.file,
      signal: opts.signal,
      onProgress: (f) => {
        fractions[i] = f;
        report();
      },
    });
    fractions[i] = 1;
    report();
    results.push({
      kind: m.kind,
      path,
      poster_path: posterPath,
      width: Math.round(m.width),
      height: Math.round(m.height),
      // Containers often report a few ms over the recording cap (180.03 s for a 3-minute phone
      // clip). assertMediaLimits already refused anything beyond 180.5 s, so declare at most 180 s.
      duration_ms: m.durationMs ? Math.min(Math.round(m.durationMs), MAX_VIDEO_SECONDS * 1000) : null,
    });
  }
  return results;
}

export function uploadErrorMessage(e: unknown): string {
  if (e instanceof UploadError) {
    switch (e.code) {
      case 'too_large':
        return e.message === 'too_long'
          ? 'Vidéo trop longue : 3 minutes maximum.'
          : e.message === 'video_too_heavy'
            ? 'Vidéo trop lourde (50 Mo maximum). Filmez en qualité standard ou raccourcissez-la.'
            : 'Fichier trop volumineux (50 Mo maximum).';
      case 'quota':
        return 'Limite d’envoi atteinte pour aujourd’hui. Réessayez demain.';
      case 'network':
        return 'Envoi interrompu : connexion instable. Votre brouillon est conservé, réessayez.';
      case 'canceled':
        return 'Envoi annulé. Votre brouillon est conservé.';
      case 'unsupported':
        return 'Format de fichier non pris en charge.';
      case 'permission':
        return e.message === 'camera_denied'
          ? 'Accès à la caméra refusé. Autorisez-le dans les réglages du téléphone.'
          : e.message === 'library_denied'
            ? 'Accès aux photos refusé. Autorisez-le dans les réglages du téléphone.'
            : 'Connectez-vous pour envoyer des fichiers.';
      default:
        return 'L’envoi a échoué. Réessayez.';
    }
  }
  return 'L’envoi a échoué. Réessayez.';
}
