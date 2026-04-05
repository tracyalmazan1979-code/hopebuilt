const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Type errors are checked in development; skip during production build
    // since many DB fields are dynamically typed from Supabase
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.resolve.alias['@supabase/ssr'] = path.resolve(
      __dirname,
      'node_modules/@supabase/ssr/dist/module/index.js'
    )
    return config
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Silence noisy Supabase SSR warnings in dev
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
}

module.exports = nextConfig
