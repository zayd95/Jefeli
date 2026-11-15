import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';
import './admin.css';

export const metadata: Metadata = {
  title: { default: 'Modération', template: '%s · Modération Jëfëli' },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
