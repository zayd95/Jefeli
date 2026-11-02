import { Redirect } from 'expo-router';

/** The center tab opens the publish sheet (/publish); this route only exists for the tab bar. */
export default function PublishTab() {
  return <Redirect href="/publish" />;
}
