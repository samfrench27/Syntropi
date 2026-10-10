import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

/**
 * Production is a static export (out/) for Cloudflare Pages: no server code at all.
 * `next dev` cannot export, and needs a rewrite so /pay/<id> reaches the single client page at /pay.
 * On Cloudflare Pages the same job is done by public/_redirects.
 */
export default function config(phase: string): NextConfig {
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  const base: NextConfig = {
    devIndicators: false,
    trailingSlash: true,
    images: { unoptimized: true },
    reactStrictMode: true,
  };
  if (dev) {
    return {
      ...base,
      async rewrites() {
        return [{ source: '/pay/:id', destination: '/pay/' }];
      },
    };
  }
  return { ...base, output: 'export' };
}
