import type { Metadata } from 'next';
import { Journal } from '@/components/admin/Journal';

export const metadata: Metadata = { title: 'Journal' };

export default function Page() {
  return <Journal />;
}
