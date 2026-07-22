import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  basePath: "/_experiences/sole-archive",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
