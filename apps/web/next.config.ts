import type { NextConfig } from "next";
import path from "path"; // Import path module

const nextConfig: NextConfig = {
  // Add Turbopack configuration to correctly infer the workspace root
  // This helps Next.js understand the monorepo structure.
  turbopack: {
    root: path.join(__dirname, '../../'), // Point to the monorepo root using an absolute path
  },
  /* config options here */
};

export default nextConfig;
