import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Ensure type checking during build
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
