import { Redirect } from 'expo-router';

/** The center tab opens the post composer (/publish → /publish/post); this route only exists for the tab bar. */
export default function PublishTab() {
  return <Redirect href="/publish" />;
}
