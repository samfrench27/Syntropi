/**
 * Pull the values of dynamic segments out of a pathname, given the route pattern.
 *
 *   matchRoute('/platform-admin/users/[id]', '/platform-admin/users/6ac9b8/') -> { id: '6ac9b8' }
 *
 * The dashboard is published as static files, so a page like /users/[id] is built once and served for
 * every id. Next's own params would then always be the placeholder, so pages read the real id from the
 * address bar instead. Returns {} when the path does not fit the pattern.
 */
export function matchRoute(pattern, pathname) {
  const want = pattern.split('/').filter(Boolean);
  const have = pathname.split('?')[0].split('#')[0].split('/').filter(Boolean);
  if (want.length !== have.length) return {};
  const out = {};
  for (let i = 0; i < want.length; i++) {
    const m = /^\[(\w+)\]$/.exec(want[i]);
    if (m) {
      let value;
      try {
        value = decodeURIComponent(have[i]);
      } catch {
        return {};
      }
      // "_" is the placeholder the static build uses; it is never a real id
      if (!value || value === '_') return {};
      out[m[1]] = value;
    } else if (want[i] !== have[i]) {
      return {};
    }
  }
  return out;
}
