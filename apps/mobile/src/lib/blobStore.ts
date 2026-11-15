/**
 * Draft files that must survive a browser refresh (W1.2). On the web a picked photo or a voice
 * recording lives in a `blob:` URL that dies with the page, so a restored draft could only fail
 * to upload. Their bytes are kept in IndexedDB under a key stored in the draft. On iOS and
 * Android the picker and the recorder give file paths that survive, so this is a no-op there.
 *
 * Every call fails soft: a browser without IndexedDB (private mode) simply loses the file and
 * the composer asks to choose it again, it never publishes a broken item.
 */
import { Platform } from 'react-native';

const DB = 'jefeli-drafts';
const STORE = 'blobs';

function available(): boolean {
  return Platform.OS === 'web' && typeof indexedDB !== 'undefined';
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function putBlob(key: string, blob: Blob): Promise<boolean> {
  if (!available()) return false;
  try {
    await run('readwrite', (s) => s.put(blob, key));
    return true;
  } catch {
    return false;
  }
}

export async function getBlob(key: string): Promise<Blob | null> {
  if (!available()) return null;
  try {
    const value = await run<unknown>('readonly', (s) => s.get(key));
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
}

/** Removes every file kept for one draft (`prefix` = the draft key). */
export async function deleteBlobs(prefix: string): Promise<void> {
  if (!available()) return;
  try {
    await run('readwrite', (s) => s.delete(IDBKeyRange.bound(`${prefix}/`, `${prefix}/￿`)));
  } catch {
    /* nothing to clean */
  }
}

export function newBlobKey(prefix: string): string {
  return `${prefix}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
