/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile OpenLayers so it works with Next.js webpack
  transpilePackages: ['ol', 'ol-ext'],

  // Optimise les imports de gros packages (réduit le temps de compilation)
  experimental: {
    optimizePackageImports: ['ol'],
  },

  // Allow images from any hostname (for point photos from backend)
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
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
