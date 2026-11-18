import { Redirect } from 'expo-router';

/** The center tab opens the Studio (see the tab bar); this route only exists to hold the tab's place. */
export default function PublishTab() {
  return <Redirect href="/studio" />;
}
