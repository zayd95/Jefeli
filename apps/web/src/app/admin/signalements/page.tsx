import type { Metadata } from 'next';
import { ReportsQueue } from '@/components/admin/ReportsQueue';

export const metadata: Metadata = { title: 'Signalements' };

export default function Page() {
  return <ReportsQueue />;
}
