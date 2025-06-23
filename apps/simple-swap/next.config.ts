import { withSentryConfig } from '@sentry/nextjs';
import { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/:path*",
      headers: [{
        key: "Document-Policy",
        value: "js-profiling",
      },],
    },];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { dev, isServer }) => {
    // Suppress warnings from Sentry/OpenTelemetry dependencies
    if (!dev) {
      config.ignoreWarnings = [
        /Critical dependency: the request of a dependency is an expression/,
        /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
        /require-in-the-middle/,
        /@opentelemetry/,
        /@sentry/
      ];
    }
    return config;
  },
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
      {
        hostname: 'ipfs',
      },
      {
        hostname: '*',
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

// export default withSentryConfig(nextConfig, {
//   // For all available options, see:
//   // https://www.npmjs.com/package/@sentry/webpack-plugin#options

//   org: "charisma-yy",
//   project: "charisma-swap",

//   // Only print logs for uploading source maps in CI
//   silent: !process.env.CI,

//   // For all available options, see:
//   // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

//   // Upload a larger set of source maps for prettier stack traces (increases build time)
//   widenClientFileUpload: true,

//   // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
//   // This can increase your server load as well as your hosting bill.
//   // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
//   // side errors will fail.
//   tunnelRoute: "/monitoring",

//   // Automatically tree-shake Sentry logger statements to reduce bundle size
//   disableLogger: true,

//   // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
//   // See the following for more information:
//   // https://docs.sentry.io/product/crons/
//   // https://vercel.com/docs/cron-jobs
//   automaticVercelMonitors: true,
// });

export default nextConfig;