import type { NextConfig } from "next";
import path from "path"; // Import path module

import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Add Turbopack configuration to correctly infer the workspace root
  // This helps Next.js understand the monorepo structure.
  turbopack: {
    root: path.join(__dirname, '../../'), // Point to the monorepo root using an absolute path
  },
  
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
