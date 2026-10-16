
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    agentFeedback: true,
  },
  serverExternalPackages: ["falkordb"],
};

export default nextConfig;
