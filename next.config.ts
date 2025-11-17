import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Ensure type checking during build
    ignoreBuildErrors: false,
  },
  // Optimize bundle size and caching
  experimental: {
    optimizePackageImports: ['lucide-react', '@supabase/ssr'],
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
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

      // Reduce bundle size by externalizing large dependencies in client
      config.externals = config.externals || [];
      if (!isServer) {
        config.externals.push({
          'lucide-react': 'lucide-react',
        });
      }
    }

    return config;
  },
};

export default nextConfig;
