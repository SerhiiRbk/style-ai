import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // The OG share-card route reads brand fonts from disk at request time; make
  // sure those files are traced into the serverless bundle on Vercel.
  outputFileTracingIncludes: {
    "/api/og/**": ["./assets/fonts/**"],
  },
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
