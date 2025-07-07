/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [],
  env: {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001',
  },
  trailingSlash: false,
  async redirects() {
    return [];
  },
}

export default nextConfig
