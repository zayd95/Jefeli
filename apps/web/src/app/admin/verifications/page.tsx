import type { Metadata } from 'next';
import { Verifications } from '@/components/admin/Verifications';

export const metadata: Metadata = { title: 'Vérifications' };

export default function Page() {
  return <Verifications />;
}
