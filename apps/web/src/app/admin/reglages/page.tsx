import type { Metadata } from 'next';
import { Settings } from '@/components/admin/Settings';

export const metadata: Metadata = { title: 'Réglages' };

export default function Page() {
  return <Settings />;
}
