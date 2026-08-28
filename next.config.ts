import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native binary modules must not be bundled by Turbopack/webpack —
  // they load at runtime via require with their platform binaries.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  // Allows a verification build to run alongside `next dev` (which locks .next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
