import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  allowedDevOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  // Performance optimizations
  experimental: {
    webpackBuildWorker: true, // Enable parallel builds
  },
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
  },
  
  // Compression
  compress: true,
};

export default withBundleAnalyzer(nextConfig);
