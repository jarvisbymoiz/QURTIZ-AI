import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the workspace root (Next infers it from lockfiles and warns when
  // multiple lockfiles exist, e.g. C:\Users\IRONMAN\package-lock.json).
  outputFileTracingRoot: path.resolve(),
  // Native binary modules must not be bundled by Turbopack/webpack -
  // they load at runtime via require with their platform binaries.
  serverExternalPackages: [
    "@resvg/resvg-js",
    "sharp",
    "satori",
    "harfbuzzjs",
    "pg",
    "pg-boss",
    "pg-connection-string",
    "detect-libc",
  ],
  // Allows a verification build to run alongside `next dev` (which locks .next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root: path.resolve(),
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "@resvg/resvg-js": false,
        sharp: false,
        pg: false,
        "pg-boss": false,
        "pg-connection-string": false,
        "detect-libc": false,
        child_process: false,
        fs: false,
        path: false,
        crypto: false,
        net: false,
        tls: false,
        dns: false,
      };
    }
    return config;
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
