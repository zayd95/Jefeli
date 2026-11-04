import { router, type Href } from 'expo-router';

/** Go back when there is history (in-app navigation), otherwise land on a sensible screen
 *  (deep links, notifications and web refreshes open screens without a back stack). */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
