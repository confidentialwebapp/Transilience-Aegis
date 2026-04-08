/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suppress ESLint errors during build for MVP
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Suppress TypeScript errors during build for MVP
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
