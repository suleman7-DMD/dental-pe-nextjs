import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Friendly aliases matching the sidebar vocabulary. `/directory` is a real
  // route (re-exports the job-market page); the rest redirect so a typed or
  // shared "plain English" URL lands on the canonical route.
  async redirects() {
    return [
      { source: "/ownership", destination: "/market-intel", permanent: false },
      { source: "/job-hunt", destination: "/launchpad", permanent: false },
      { source: "/acquisition", destination: "/buyability", permanent: false },
      { source: "/acquisition-scout", destination: "/buyability", permanent: false },
      { source: "/review-desk", destination: "/warroom", permanent: false },
      { source: "/pe-deals", destination: "/deal-flow", permanent: false },
      { source: "/evidence", destination: "/research", permanent: false },
      { source: "/research-notes", destination: "/intelligence", permanent: false },
      { source: "/methodology", destination: "/data-breakdown", permanent: false },
    ];
  },
};

export default nextConfig;
