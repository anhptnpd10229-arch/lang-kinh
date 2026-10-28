import type { NextConfig } from "next";

// Xuất tĩnh (SSG) để host trên Cloudflare Pages, không cần server.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
