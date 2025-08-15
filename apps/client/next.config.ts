import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@taskmanagement/shared",
    "@taskmanagement/database", 
    "@taskmanagement/ui",
    "@taskmanagement/config"
  ],
  experimental: {
    typedRoutes: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001",
  },
};

export default nextConfig;
