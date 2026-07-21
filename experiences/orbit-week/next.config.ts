import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  basePath: "/_experiences/orbit-week",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
