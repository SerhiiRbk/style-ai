import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // The OG share-card route reads brand fonts from disk at request time; make
  // sure those files are traced into the serverless bundle on Vercel.
  //
  // The PDF export uses `sharp` (native libvips) to cover-crop report photos.
  // Sharp is auto-externalized, but the platform-specific native binaries are
  // not always traced into the function bundle — force-include them so the PDF
  // route never fails with "Could not load the sharp module" on Vercel.
  outputFileTracingIncludes: {
    "/api/og/**": ["./assets/fonts/**"],
    "/api/reports/**": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
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
