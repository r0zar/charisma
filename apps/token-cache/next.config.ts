import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.hiro.so',
        // port: '', // Optional: specify port if needed
        // pathname: '/account/**', // Optional: specify path if needed
      },
      // Add other allowed hostnames here if needed
      // {
      //   protocol: 'https',
      //   hostname: 'another.domain.com',
      // },
    ],
  },
};

export default nextConfig;
