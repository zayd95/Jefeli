import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // The shared package ships TypeScript sources (tokens, labels, formatters, DB types).
  transpilePackages: ['@jefeli/shared'],
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  // Share pages are ISR (60 s). Bound how long a CDN may serve a stale copy, so content removed by
  // moderation disappears within minutes rather than the 1-year default.
  expireTime: 600,
  async redirects() {
    return [{ source: '/admin', destination: '/admin/signalements', permanent: false }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // The moderation console must never be framed or indexed.
        source: '/admin/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
