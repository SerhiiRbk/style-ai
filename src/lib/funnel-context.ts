import "server-only";
import { cookies, headers } from "next/headers";
import { logEvent, type EventInput } from "@/lib/events";
import {
  ATTR_COOKIE,
  attributionFromHeaders,
  compactAttribution,
  mergeAttribution,
  parseAttributionCookie,
  parseAttributionFromSearch,
  type Attribution,
} from "@/lib/funnel";

export function attributionFromRequest(request: Request): Attribution {
  const url = new URL(request.url);
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${ATTR_COOKIE}=`));
  const raw = cookie
    ? decodeURIComponent(cookie.slice(ATTR_COOKIE.length + 1))
    : null;
  return mergeAttribution(
    mergeAttribution(
      attributionFromHeaders(request.headers),
      parseAttributionCookie(raw),
    ),
    parseAttributionFromSearch(url.searchParams),
  );
}

export async function pageAttribution(): Promise<{
  anonId: string | null;
  props: Record<string, unknown>;
}> {
  const jar = await cookies();
  const h = await headers();
  const attr = mergeAttribution(
    attributionFromHeaders(h),
    parseAttributionCookie(jar.get(ATTR_COOKIE)?.value),
  );
  return {
    anonId: jar.get("valetti_anon")?.value ?? null,
    props: compactAttribution(attr),
  };
}

export async function logPageEvent(
  name: string,
  extra?: { userId?: string | null; props?: Record<string, unknown> },
): Promise<void> {
  const ctx = await pageAttribution();
  await logEvent({
    name,
    anonId: ctx.anonId,
    userId: extra?.userId ?? null,
    props: { ...ctx.props, ...extra?.props },
  });
}

export function logRequestEvent(
  request: Request,
  event: Omit<EventInput, "props"> & { props?: Record<string, unknown> },
): Promise<void> {
  return logEvent({
    ...event,
    props: {
      ...compactAttribution(attributionFromRequest(request)),
      ...event.props,
    },
  });
}
