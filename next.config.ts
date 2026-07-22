import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
    optimizePackageImports: ["@hugeicons/core-free-icons", "@hugeicons/react"],
  },
};

export default nextConfig;
