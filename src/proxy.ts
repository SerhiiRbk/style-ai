import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** SEO / crawler files must not create valetti_anon or other cookies. */
function isSeoPassthrough(pathname: string): boolean {
  if (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/google-sitemap.xml"
  ) {
    return true;
  }
  // Trailing-slash / query variants still hit the proxy matcher.
  if (
    pathname.startsWith("/google-sitemap.xml") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.startsWith("/sitemaps/")
  ) {
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  if (isSeoPassthrough(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|google-sitemap\\.xml|sitemaps/|images/|.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
