import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["music-metadata"],
  allowedDevOrigins: ["192.168.108.108", "0.0.0.0"],
};

export default nextConfig;
