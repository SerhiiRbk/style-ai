import {
  ATTR_COOKIE,
  compactAttribution,
  parseAttributionCookie,
} from "@/lib/funnel";

function cookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getAnonId(): string {
  try {
    const KEY = "valetti_anon";
    const cookie = cookieValue(KEY);
    if (cookie) {
      localStorage.setItem(KEY, cookie);
      return cookie;
    }
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    document.cookie = `${KEY}=${id}; path=/; max-age=31536000; samesite=lax`;
    return id;
  } catch {
    return "";
  }
}

function clientAttribution(): Record<string, unknown> {
  const fromCookie = parseAttributionCookie(cookieValue(ATTR_COOKIE));
  const lang =
    typeof navigator !== "undefined" ? navigator.language?.slice(0, 16) : "";
  return compactAttribution({
    ...fromCookie,
    lang: fromCookie.lang ?? lang.toLowerCase(),
  });
}

/** Fire-and-forget funnel event (sendBeacon so it survives navigation). */
export function trackEvent(
  name: string,
  props?: Record<string, unknown>,
): void {
  try {
    const body = JSON.stringify({
      name,
      anonId: getAnonId(),
      props: { ...clientAttribution(), ...props },
    });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/events",
        new Blob([body], { type: "application/json" }),
      );
    } else {
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    /* analytics must never break the UI */
  }
}
