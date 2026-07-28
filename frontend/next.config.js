/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep `next build` from corrupting a concurrently running `next dev` cache.
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
  output: "standalone",
  eslint: {
    // Do not fail production builds on lint errors; lint is run separately.
    ignoreDuringBuilds: false,
  },
  experimental: {
    // React Flow and Recharts pull in ESM-heavy deps; keep transpile lean.
  },
};

module.exports = nextConfig;
