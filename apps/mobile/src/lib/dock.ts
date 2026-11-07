import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the floating five-tab dock itself (58-pt items + 5-pt padding + hairline border). */
export const DOCK_HEIGHT = 70;
export const DOCK_GAP = 12;

/** Bottom padding a tab screen needs so its last item scrolls clear of the floating dock. */
export function useDockSpace(extra = 16): number {
  const insets = useSafeAreaInsets();
  return DOCK_HEIGHT + Math.max(insets.bottom, DOCK_GAP) + extra;
}
