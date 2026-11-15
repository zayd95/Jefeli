/**
 * Session storage for Supabase Auth.
 * Native: iOS Keychain / Android Keystore via expo-secure-store. SecureStore values are
 * limited (~2 KB) and Supabase sessions can exceed that, so values are chunked.
 * Web: localStorage (the web build is only used for development previews).
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK = 1800;
const keyFor = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function getItem(key: string): Promise<string | null> {
  const k = keyFor(key);
  const count = await SecureStore.getItemAsync(`${k}.n`);
  if (count === null) return null;
  const n = Number.parseInt(count, 10);
  let out = '';
  for (let i = 0; i < n; i++) {
    const part = await SecureStore.getItemAsync(`${k}.${i}`);
    if (part === null) return null;
    out += part;
  }
  return out;
}

async function removeItem(key: string): Promise<void> {
  const k = keyFor(key);
  const count = await SecureStore.getItemAsync(`${k}.n`);
  const n = count ? Number.parseInt(count, 10) : 0;
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
  await SecureStore.deleteItemAsync(`${k}.n`);
}

async function setItem(key: string, value: string): Promise<void> {
  await removeItem(key);
  const k = keyFor(key);
  const parts = Math.ceil(value.length / CHUNK) || 1;
  for (let i = 0; i < parts; i++) {
    await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  await SecureStore.setItemAsync(`${k}.n`, String(parts));
}

const webStorage = {
  getItem: async (key: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
  setItem: async (key: string, value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

export const authStorage = Platform.OS === 'web' ? webStorage : { getItem, setItem, removeItem };
