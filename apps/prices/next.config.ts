import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/brand'],
  serverExternalPackages: ['@google-cloud/bigquery'],
};

export default nextConfig;
