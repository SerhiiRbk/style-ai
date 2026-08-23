import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { isPublicHttpUrl, parseProductPageMeta } from "@/lib/og-page-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MAX_HTML_BYTES = 1_500_000;
const FETCH_MS = 10_000;

/**
 * Admin helper: fetch a product page and return title / description / image
 * (JSON-LD Product first, Open Graph second) so the catalogue editor can
 * prefill the add/edit form.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  if (!raw || !isPublicHttpUrl(raw)) {
    return NextResponse.json(
      { error: "A public http(s) product URL is required" },
      { status: 400 },
    );
  }

  const pageUrl = new URL(raw).href;
  let res: Response;
  try {
    res = await fetch(pageUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_MS),
      headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not fetch the product page" },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Product page returned ${res.status}` },
      { status: 502 },
    );
  }

  const ctype = res.headers.get("content-type") ?? "";
  if (ctype && !/text\/html|application\/xhtml\+xml/i.test(ctype)) {
    return NextResponse.json(
      { error: "That URL is not an HTML page" },
      { status: 422 },
    );
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_HTML_BYTES) {
    return NextResponse.json(
      { error: "Product page is too large to read" },
      { status: 422 },
    );
  }

  const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const meta = parseProductPageMeta(html, res.url || pageUrl);
  if (!meta.title && !meta.description && !meta.imageUrl) {
    return NextResponse.json(
      { error: "No title, description or image found on that page" },
      { status: 422 },
    );
  }

  return NextResponse.json({
    title: meta.title,
    description: meta.description,
    imageUrl: meta.imageUrl,
    brand: meta.brand,
    price: meta.price,
    currency: meta.currency,
    url: pageUrl,
  });
}
