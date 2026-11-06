import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Static export — this app is 100% client-rendered (no server
     actions/API routes), so it ships as plain static files to GitHub
     Pages exactly like the old Vite build did. cacheComponents/
     partialPrefetching (server-rendering features) are incompatible with
     `output: "export"` and are dropped here for that reason. */
  output: "export",
  // GitHub Pages serves this repo at /akasushi-v2/, same as the Vite site's
  // own vite.config.js — every absolute asset path needs this prefix or
  // it 404s one level too high.
  basePath: "/akasushi-v2",
  images: {
    unoptimized: true,
  },
  // Dev server blocks cross-origin HMR/dev-resource requests by default —
  // needed to open this on a phone/another device over the LAN. No
  // effect on the production static export.
  allowedDevOrigins: ["10.255.252.20"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
