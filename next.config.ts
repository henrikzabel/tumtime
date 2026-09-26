import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Club pictures from the TUM Student Club Gallery.
    remotePatterns: [{ protocol: "https", hostname: "www.tum.de", pathname: "/fileadmin/**" }],
  },
};

export default nextConfig;
