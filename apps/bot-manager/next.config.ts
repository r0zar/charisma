import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/PokeAPI/sprites/master/sprites/pokemon/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Polyfill Node.js modules for client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'timers/promises': false,
        'timers': false,
        'fs': false,
        'path': false,
        'os': false,
        'crypto': false,
        'stream': false,
        'util': false,
        'buffer': false,
        'events': false,
        'async_hooks': false,
      };
    }
    return config;
  },
};

export default nextConfig;