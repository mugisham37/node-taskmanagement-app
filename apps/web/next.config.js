/** @type {import('next').NextConfig} */
const { withSuperjson } = require('next-superjson')

const nextConfig = withSuperjson()({
  // Basic configuration
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  
  // Performance optimizations
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    legacyBrowsers: false,
    browsersListForSwc: true,
    serverComponentsExternalPackages: ['@taskmanagement/database'],
  },

  // Image optimization
  images: {
    domains: ['localhost', 'taskmanagement.app'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
    ]
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/dashboard/overview',
        permanent: false,
      },
    ]
  },

  // Rewrites for API routes
  async rewrites() {
    return [
      {
        source: '/api/trpc/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/trpc/:path*`,
      },
    ]
  },

  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle analyzer
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      )
    }

    // Optimize bundle splitting
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      }
    }

    // Handle workspace packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@taskmanagement/auth': require.resolve('@taskmanagement/auth'),
      '@taskmanagement/types': require.resolve('@taskmanagement/types'),
      '@taskmanagement/validation': require.resolve('@taskmanagement/validation'),
      '@taskmanagement/ui': require.resolve('@taskmanagement/ui'),
      '@taskmanagement/i18n': require.resolve('@taskmanagement/i18n'),
      '@taskmanagement/utils': require.resolve('@taskmanagement/utils'),
      '@taskmanagement/config': require.resolve('@taskmanagement/config'),
    }

    return config
  },

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Output configuration
  output: 'standalone',
  
  // Compression
  compress: true,
  
  // Generate ETags
  generateEtags: true,
  
  // Page extensions
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  
  // Trailing slash
  trailingSlash: false,
})

module.exports = nextConfig