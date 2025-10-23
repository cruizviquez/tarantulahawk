import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Disable type checking during build if needed
    ignoreBuildErrors: false,
  },
  // Disable build cache to ensure fresh builds
  experimental: {
    turbotrace: {
      memoryLimit: 6000,
    },
  },
};

export default nextConfig;
