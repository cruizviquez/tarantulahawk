import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Ensure type checking during build
    ignoreBuildErrors: false,
  },
  // Optimize bundle size and caching
  experimental: {
    optimizePackageImports: ['lucide-react', '@supabase/ssr'],
  },
  webpack: (config, { dev, isServer }) => {
    // Optimize for production builds
    if (!dev && !isServer) {
      // Enable webpack optimizations
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
            lucide: {
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              name: 'lucide-icons',
              chunks: 'all',
              priority: 10,
            },
          },
        },
      };
    }

    return config;
  },
};

export default nextConfig;
