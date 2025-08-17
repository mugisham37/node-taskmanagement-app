const { withSentryConfig } = require('@sentry/nextjs');
const { PerformanceBudgetPlugin } = require('../../tools/build/performance-budgets');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Experimental features for performance
  experimental: {
    // Enable modern bundling
    esmExternals: true,
    // Enable SWC minification
    swcMinify: true,
    // Enable concurrent features
    concurrentFeatures: true,
    // Enable server components
    serverComponents: true,
  },

  // Compiler options
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
    // Enable SWC relay plugin
    relay: {
      src: './src',
      language: 'typescript',
    },
  },

  // Image optimization
  images: {
    // Enable modern image formats
    formats: ['image/avif', 'image/webp'],
    // Image domains
    domains: [
      'localhost',
      process.env.NEXT_PUBLIC_CDN_DOMAIN,
      process.env.NEXT_PUBLIC_API_DOMAIN,
    ].filter(Boolean),
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for different breakpoints
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Minimize layout shift
    minimumCacheTTL: 31536000, // 1 year
    // Enable dangerous allow SVG
    dangerouslyAllowSVG: true,
    // Content security policy for SVG
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Bundle analyzer
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Performance optimizations
    if (!dev && !isServer) {
      // Add performance budget plugin
      config.plugins.push(
        new PerformanceBudgetPlugin({
          appType: 'web',
          failOnError: process.env.CI === 'true',
          outputPath: './dist/reports',
        })
      );

      // Optimize chunks
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Framework chunk (React, Next.js)
          framework: {
            chunks: 'all',
            name: 'framework',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },
          // Commons chunk
          lib: {
            test(module) {
              return module.size() > 160000 && /node_modules[/\\]/.test(module.identifier());
            },
            name: 'lib',
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          // Shared chunks
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
          },
          // Shared UI components
          shared: {
            name: 'shared',
            test: /[\\/]packages[\\/](ui|utils|types)[\\/]/,
            priority: 10,
          },
        },
      };

      // Bundle analyzer
      if (process.env.ANALYZE === 'true') {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: './bundle-analyzer-report.html',
          })
        );
      }
    }

    // Resolve aliases for better tree shaking
    config.resolve.alias = {
      ...config.resolve.alias,
      '@taskmanagement/core': require.resolve('../../packages/core/src'),
      '@taskmanagement/types': require.resolve('../../packages/types/src'),
      '@taskmanagement/utils': require.resolve('../../packages/utils/src'),
      '@taskmanagement/ui': require.resolve('../../packages/ui/src'),
      '@taskmanagement/auth': require.resolve('../../packages/auth/src'),
      '@taskmanagement/validation': require.resolve('../../packages/validation/src'),
      '@taskmanagement/i18n': require.resolve('../../packages/i18n/src'),
    };

    return config;
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
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
            value: 'origin-when-cross-origin',
          },
          // Performance headers
          {
            key: 'X-Robots-Tag',
            value: 'index, follow',
          },
        ],
      },
      // Static assets caching
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API routes caching
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },

  // Redirects for performance
  async redirects() {
    return [
      // Redirect www to non-www
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.taskmanagement.com',
          },
        ],
        destination: 'https://taskmanagement.com/:path*',
        permanent: true,
      },
    ];
  },

  // Rewrites for API proxy
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },

  // Output configuration
  output: 'standalone',
  
  // Compression
  compress: true,

  // Power by header
  poweredByHeader: false,

  // React strict mode
  reactStrictMode: true,

  // SWC options
  swcMinify: true,

  // Trailing slash
  trailingSlash: false,

  // TypeScript configuration
  typescript: {
    // Ignore build errors in production (handled by CI)
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },

  // ESLint configuration
  eslint: {
    // Ignore during builds (handled by CI)
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
};

// Sentry configuration for error tracking
const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

module.exports = process.env.NODE_ENV === 'production' 
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;