import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/coverage/:path*',
        destination: '/_coverage/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/_coverage/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;