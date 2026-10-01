import type { NextConfig } from "next";

/**
 * charisma.rocks is also the address of 189 token images (/sip10/…, /stx-logo.png…) and the token metadata
 * APIs (/api/v0/metadata/…) that wallets and on-chain token URIs point to. Those stay on the old charisma-web
 * deployment: any path this app doesn't serve is passed through to LEGACY_ORIGIN.
 */
const legacy = process.env.LEGACY_ORIGIN;
if (!legacy && process.env.NODE_ENV === 'production') {
  throw new Error('LEGACY_ORIGIN is required in production: the charisma-web deployment that serves /api/* and the token images');
}

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/brand'],
  async rewrites() {
    return legacy ? { beforeFiles: [], afterFiles: [], fallback: [{ source: '/:path*', destination: `${legacy}/:path*` }] } : [];
  },
};

export default nextConfig;
