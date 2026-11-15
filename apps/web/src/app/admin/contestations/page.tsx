import type { Metadata } from 'next';
import { Appeals } from '@/components/admin/Appeals';

export const metadata: Metadata = { title: 'Contestations' };

export default function Page() {
  return <Appeals />;
}
