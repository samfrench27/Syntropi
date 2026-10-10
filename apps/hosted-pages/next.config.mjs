const isDev = process.env.NODE_ENV !== 'production'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Cloudflare Pages: no server code. Output goes to out/.
  output: 'export',
  // /sessions/index.html, so public/_redirects can serve one file for every payment id.
  trailingSlash: true,
  images: { unoptimized: true },
  // Dev only: `next dev` has no _redirects, so serve the same single page for /sessions/:id.
  // (A production export has no rewrites; Cloudflare Pages does this with public/_redirects.)
  ...(isDev
    ? {
        async rewrites() {
          return [{ source: '/sessions/:id', destination: '/sessions' }]
        },
      }
    : {}),
}

export default nextConfig
