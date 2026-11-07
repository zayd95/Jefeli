import { deepLinks, webAppLinks } from '@jefeli/shared';

import { env } from './env';

/** The web beta opens Jëfëli in the browser; without NEXT_PUBLIC_APP_URL the buttons keep the native deep links. */
export const opensInBrowser = Boolean(env.appUrl);

/** Where « open in Jëfëli » buttons go: the web app when it is configured, the native app otherwise. */
export const appLinks = opensInBrowser ? webAppLinks(env.appUrl) : deepLinks;
