import { Redirect } from 'expo-router';

/**
 * No intermediary publishing hub (Lovable parity): « /publish » opens the Publication composer,
 * whose switcher offers Article and Statut. Live is not part of the product (W1.1).
 */
export default function PublishIndex() {
  return <Redirect href="/publish/post" />;
}
