import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The old study planner and timetable were replaced by the degree planner and the scheduler.
  async redirects() {
    return [
      { source: "/planner", destination: "/degree-planner", permanent: true },
      { source: "/planner/:slug", destination: "/degree-planner/new?program=:slug", permanent: true },
      { source: "/timetable", destination: "/schedules", permanent: true },
    ];
  },
  images: {
    // Club pictures from the TUM Student Club Gallery.
    remotePatterns: [{ protocol: "https", hostname: "www.tum.de", pathname: "/fileadmin/**" }],
  },
};

export default nextConfig;
