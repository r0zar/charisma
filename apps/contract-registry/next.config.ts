import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@stacks/connect", "@stacks/connect-ui"],
  experimental: {
    esmExternals: "loose"
  }
};

export default nextConfig;