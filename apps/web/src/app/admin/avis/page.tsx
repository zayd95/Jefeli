import type { Metadata } from 'next';
import { Feedback } from '@/components/admin/Feedback';

export const metadata: Metadata = { title: 'Avis' };

export default function Page() {
  return <Feedback />;
}
