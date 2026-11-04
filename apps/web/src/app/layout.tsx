import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
import { env } from '@/lib/env';
import { themeCss } from '@/lib/theme';
import { EnvBanner } from '@/components/Chrome';

const DESCRIPTION =
  'Jëfëli, le réseau social du commerce sénégalais\u00A0: profils, publications et boutiques de vendeurs, neuf, occasion et troc.';

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: 'Jëfëli — Le réseau social du commerce sénégalais', template: '%s · Jëfëli' },
  description: DESCRIPTION,
  applicationName: 'Jëfëli',
  openGraph: {
    siteName: 'Jëfëli',
    locale: 'fr_SN',
    type: 'website',
    title: 'Jëfëli — Le réseau social du commerce sénégalais',
    description: DESCRIPTION,
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Jëfëli — Découvre. Partage. Vends.' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-default.png'] },
  // Test environments must never be indexed.
  robots: env.isProduction ? { index: true, follow: true } : { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: '#F6F5F1',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body>
        <a className="skip-link" href="#contenu">
          Aller au contenu
        </a>
        <EnvBanner />
        {children}
      </body>
    </html>
  );
}
