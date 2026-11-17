import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images-assets.nasa.gov" },
      { protocol: "https", hostname: "assets.science.nasa.gov" },
      { protocol: "https", hostname: "science.nasa.gov" },
      { protocol: "https", hostname: "apod.nasa.gov" },
      { protocol: "https", hostname: "esawebb.org" },
    ],
  },
};

export default nextConfig;
