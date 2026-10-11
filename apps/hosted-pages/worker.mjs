// Serves the static export (./out) and one rewrite: every /sessions/<id> is answered by the single
// page at /sessions/, which reads the id from the address in the browser. The id is never used here.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // This Worker only runs for paths that are not a file in the export
    if (url.pathname.startsWith('/sessions/')) {
      return env.ASSETS.fetch(new Request(new URL('/sessions/', url), request));
    }
    return env.ASSETS.fetch(request);
  },
};
