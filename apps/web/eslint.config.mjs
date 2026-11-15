import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: '.' } },
    rules: {
      // Media is served straight from Supabase Storage (public buckets / short-lived signed
      // URLs). next/image optimisation refuses local IPs in dev and would proxy user uploads,
      // so plain <img> with explicit sizes + lazy loading is used on purpose.
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'screenshots/**']),
]);
