import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: "/api/assets/**" },
      { pathname: "/images/**" },
    ],
    remotePatterns: [
      // Legacy Supabase signed URLs (demo / external catalog images).
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
};

export default withWorkflow(nextConfig);
