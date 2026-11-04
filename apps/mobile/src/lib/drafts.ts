/**
 * Local drafts so a failed or cancelled upload never loses what the member typed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

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
