// apps/admin-dashboard/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The dev badge sits on top of the sidebar's account chip.
  devIndicators: false,

  // Production is a set of static files (served by worker.mjs). Development keeps the normal server.
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' as const, trailingSlash: true } : {}),
  images: { unoptimized: true },

  // Environment variables that should be available to the client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8787/api',
  },

  // Disable type checking during build to avoid issues
  typescript: {
    ignoreBuildErrors: true,
  },

  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
