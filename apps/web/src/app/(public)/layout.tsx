import { SiteFooter, SiteHeader } from '@/components/Chrome';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="contenu">{children}</main>
      <SiteFooter />
    </>
  );
}
