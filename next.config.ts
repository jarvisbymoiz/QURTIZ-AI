import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native binary modules must not be bundled by Turbopack/webpack -
  // they load at runtime via require with their platform binaries.
  serverExternalPackages: ["@resvg/resvg-js", "sharp", "satori", "harfbuzzjs"],
  // Allows a verification build to run alongside `next dev` (which locks .next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      // Visual/brand-asset uploads go through Server Actions as FormData
      // (uploadVisualUploadAction, brand assets). Default limit is 1 MB.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
