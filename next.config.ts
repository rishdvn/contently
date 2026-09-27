import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /* Thumbnails of media in Convex storage (stock and uploads). The originals
       are full-size camera files; a grid of them unresized would be hundreds of
       megabytes. Storage URLs are unguessable and public, so any deployment's
       will do. */
    remotePatterns: [{ protocol: "https", hostname: "*.convex.cloud", pathname: "/api/storage/**" }],
  },
};

export default nextConfig;
