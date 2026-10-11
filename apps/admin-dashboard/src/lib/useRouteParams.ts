'use client';

import { matchRoute } from './routeParams.mjs';

/**
 * Drop-in replacement for next/navigation's useParams for the pages with an id in the address.
 * Reads the real id from the browser address (see routeParams.mjs for why).
 *
 * Typed like useParams (the values are strings). The one time a value is missing is the static
 * build, which has no address; the pages only use the id inside effects and event handlers, and
 * those do not run at build time.
 */
export function useRouteParams<T extends Record<string, string>>(pattern: string): T {
  if (typeof window === 'undefined') return {} as T;
  return matchRoute(pattern, window.location.pathname) as T;
}
