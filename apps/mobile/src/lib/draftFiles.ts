/**
 * Photos and videos of a draft, kept across a browser refresh (W1.2). On the web the picked file
 * lives in a `blob:` URL that dies with the page: without this, a restored draft showed broken
 * thumbnails and could only fail to upload. Native file paths survive, nothing to do there.
 */
import { Platform } from 'react-native';

import { getBlob, newBlobKey, putBlob } from './blobStore';
import type { LocalMedia } from './upload';

/** Stores the bytes of newly picked files and returns the items with their `blobKey`. */
export async function keepMediaForDraft(draftKey: string, items: LocalMedia[]): Promise<LocalMedia[]> {
  if (Platform.OS !== 'web') return items;
  return Promise.all(
    items.map(async (m) => {
      if (m.blobKey || !(m.file instanceof Blob)) return m;
      const key = newBlobKey(draftKey);
      return (await putBlob(key, m.file)) ? { ...m, blobKey: key } : m;
    }),
  );
}

/**
 * Rebuilds restored items from IndexedDB. Items whose bytes are gone are dropped (`lost` counts
 * them) so the member chooses them again instead of publishing a broken file.
 */
export async function restoreDraftMedia(items: LocalMedia[]): Promise<{ items: LocalMedia[]; lost: number }> {
  if (Platform.OS !== 'web') return { items, lost: 0 };
  const restored = await Promise.all(
    items.map(async (m) => {
      const blob = m.blobKey ? await getBlob(m.blobKey) : null;
      if (!blob) return null;
      return { ...m, file: blob, uri: URL.createObjectURL(blob), posterFile: null, posterUri: null } as LocalMedia;
    }),
  );
  const kept = restored.filter((m): m is LocalMedia => m !== null);
  return { items: kept, lost: items.length - kept.length };
}
