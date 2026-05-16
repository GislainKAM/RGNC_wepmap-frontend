/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output : image Docker autonome (~40% plus petite)
  output: 'standalone',

  // Compression Gzip/Brotli des assets JS/CSS servis par Next.js
  compress: true,

  // Transpile OpenLayers so it works with Next.js webpack
  transpilePackages: ['ol', 'ol-ext'],

  // Optimise les imports de gros packages (tree-shaking, réduit le bundle)
  experimental: {
    optimizePackageImports: ['ol', '@tanstack/react-query'],
  },

  // Photos de bornes servies par le backend Django.
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'http',  hostname: '127.0.0.1' },
      ...(process.env.NEXT_PUBLIC_BACKEND_HOSTNAME
        ? [{ protocol: 'https', hostname: process.env.NEXT_PUBLIC_BACKEND_HOSTNAME }]
        : []),
    ],
    // Formats modernes (WebP / AVIF) auto-convertis par Next Image
    formats: ['image/avif', 'image/webp'],
  },

  // Headers HTTP de sécurité + cache
  async headers() {
    return [
      {
        // Assets statiques Next.js — cache long (immutable)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Pages HTML — revalidation à chaque requête
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ]
  },

  // Webpack config for OpenLayers compatibility
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
