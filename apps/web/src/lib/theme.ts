import { colors, palette, radius } from '@jefeli/shared';

/**
 * Atlantic Sand tokens from @jefeli/shared exposed as CSS custom properties, so the web app and
 * the mobile app stay on one source of truth. Injected once in the root layout.
 */
const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export function themeCss(): string {
  const vars: string[] = [];
  for (const [k, v] of Object.entries(palette)) vars.push(`--p-${kebab(k)}:${v}`);
  for (const [k, v] of Object.entries(colors)) vars.push(`--c-${kebab(k)}:${v}`);
  for (const [k, v] of Object.entries(radius)) vars.push(`--r-${kebab(k)}:${v}px`);
  return `:root{${vars.join(';')}}`;
}
