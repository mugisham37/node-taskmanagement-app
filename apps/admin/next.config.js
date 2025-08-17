/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Enable SWC minification for better performance
  swcMinify: true,
  
  // Experimental features
  experimental: {
    // Enable app directory for new routing system
    appDir: true,
    // Enable server components
    serverComponentsExternalPackages: ['@taskmanagement/database'],
  },
  
  // Image optimization configuration
  images: {
    domains: ['localhost', 'api.taskmanagement.com'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Internationalization
  i18n: {
    locales: ['en', 'es', 'fr', 'de', 'zh'],
    defaultLocale: 'en',
    localeDetection: true,
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  
  // Redirects for admin-specific routes
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
  
  // Webpack configuration for monorepo
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Handle workspace packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': './src',
      '@/components': './src/components',
      '@/pages': './src/pages',
      '@/hooks': './src/hooks',
      '@/services': './src/services',
      '@/store': './src/store',
      '@/utils': './src/utils',
      '@/types': './src/types',
      '@/config': './src/config',
    };
    
    // Optimize bundle size
    if (!dev && !isServer) {
      config.optimization.splitChunks.chunks = 'all';
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        taskmanagement: {
          test: /[\\/]packages[\\/]/,
          name: 'taskmanagement',
          chunks: 'all',
        },
      };
    }
    
    return config;
  },
  
  // Output configuration
  output: 'standalone',
  
  // Performance budgets
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  
  // Compiler options
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;