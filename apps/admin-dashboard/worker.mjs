// Serves the static export (./out) and one rewrite: the pages with an id in the address
// (/platform-admin/users/<id> and so on) are built once, for a placeholder id, and this Worker
// answers every real id with that page. The page reads the real id from the browser address.
// The id is never used here.
const ID_PAGES = [
  '/org-admin/analytics/payments',
  '/org-admin/payments',
  '/platform-admin/analytics/payments',
  '/platform-admin/api-keys',
  '/platform-admin/organizations',
  '/platform-admin/payments',
  '/platform-admin/providers',
  '/platform-admin/users',
];

export default {
  async fetch(request, env) {
    // This Worker only runs for paths that are not a file in the export
    const url = new URL(request.url);
    for (const base of ID_PAGES) {
      if (url.pathname.startsWith(base + '/')) {
        const rest = url.pathname.slice(base.length + 1).replace(/\/$/, '');
        // "create" is a real page; anything else is an id
        if (rest && !rest.includes('/') && rest !== 'create') {
          return env.ASSETS.fetch(new Request(new URL(`${base}/_/`, url), request));
        }
      }
    }
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    // Unknown path: show the app's own "not found" page, with the right status
    const page = await env.ASSETS.fetch(new Request(new URL('/404.html', url)));
    return new Response(page.body, { status: 404, headers: page.headers });
  },
};
