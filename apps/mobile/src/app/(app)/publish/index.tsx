import { Redirect } from 'expo-router';

/**
 * No intermediary publishing hub (Lovable parity): « /publish » opens the Publication composer,
 * whose switcher offers Article and Statut, and whose Live entry stays disabled until the video
 * provider is configured.
 */
export default function PublishIndex() {
  return <Redirect href="/publish/post" />;
}
