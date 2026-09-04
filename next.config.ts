import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (Next infers it from lockfiles and warns when
  // multiple lockfiles exist, e.g. C:\Users\IRONMAN\package-lock.json).
  outputFileTracingRoot: path.resolve(),
  // Native binary modules must not be bundled by Turbopack/webpack -
  // they load at runtime via require with their platform binaries.
  serverExternalPackages: ["@resvg/resvg-js", "sharp", "satori", "harfbuzzjs"],
  // Allows a verification build to run alongside `next dev` (which locks .next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root: path.resolve(),
  },
  experimental: {
    serverActions: {
      // Visual/brand-asset uploads go through Server Actions as FormData
      // (uploadVisualUploadAction, brand assets). Default limit is 1 MB.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
