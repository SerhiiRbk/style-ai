import { NextResponse } from "next/server";
import { buildGoogleSitemapXml } from "@/lib/google-sitemap";

/** Fresh sitemap path for GSC — bypasses cached "Couldn't fetch" on old URLs. */
export const dynamic = "force-static";

export function GET() {
  return new NextResponse(buildGoogleSitemapXml(), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
