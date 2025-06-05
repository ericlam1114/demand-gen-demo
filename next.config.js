/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during builds to allow deployment with warnings
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig 