import { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  env: {
    // Default values for local development
    NEXT_PUBLIC_DEX_CACHE_URL: process.env.NEXT_PUBLIC_DEX_CACHE_URL || "http://localhost:3003/api/v1",
    NEXT_PUBLIC_ROUTER_ADDRESS: process.env.NEXT_PUBLIC_ROUTER_ADDRESS || "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
    NEXT_PUBLIC_ROUTER_NAME: process.env.NEXT_PUBLIC_ROUTER_NAME || "multihop",
  },
};

export default nextConfig;
