/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
