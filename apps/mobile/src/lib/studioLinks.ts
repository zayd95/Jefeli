/** Every way into the Studio (P2). One screen, a few presets. */
export const STUDIO = {
  open: '/studio',
  status: '/studio?dest=status',
  article: '/studio?sell=1',
  seek: '/studio?intent=seek',
  voice: '/studio?mode=voice',
  present: (productId: string) => `/studio?product=${productId}`,
} as const;
