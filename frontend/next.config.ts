import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",      // Static export → Cloudflare Pages
  trailingSlash: true,   // Required for Cloudflare Pages routing
  images: { unoptimized: true },
};

export default nextConfig;
