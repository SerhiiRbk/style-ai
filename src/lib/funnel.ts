/**
 * Launch funnel — event names and first-touch attribution.
 * Client-safe: no server-only imports.
 */

export const ATTR_COOKIE = "valetti_attr";

export const FUNNEL_EVENTS = [
  "colours_view",
  "colours_result",
  "intake_started",
  "photo_uploaded",
  "intake_completed",
  "report_ready",
  "report_shared",
  "shared_report_view",
  "pricing_view",
  "checkout_started",
  "credits_purchased",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

/** Events the public /api/events endpoint may accept from the browser. */
export const CLIENT_FUNNEL_EVENTS = [
  "colours_view",
  "colours_started",
  "colours_result",
  "quiz_started",
  "quiz_result",
  "affiliate_click",
  "filter_changed",
  "shop_colours_click",
  "tryon_gate_click",
  "look_set_started",
  "look_set_shared",
  "report_shared",
  "pricing_view",
] as const;

export type Attribution = {
  lang?: string;
  country?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer_report_id?: string;
};

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFunnelEvent(name: string): name is FunnelEventName {
  return (FUNNEL_EVENTS as readonly string[]).includes(name);
}

export function isClientFunnelEvent(name: string): boolean {
  return (CLIENT_FUNNEL_EVENTS as readonly string[]).includes(name);
}

export function isReportId(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value));
}

/** First language tag from Accept-Language / navigator.language. */
export function langFromAccept(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const tag = raw.split(",")[0]?.trim().split(";")[0]?.trim();
  if (!tag) return undefined;
  return tag.slice(0, 16).toLowerCase();
}

export function parseAttributionFromSearch(
  search: string | URLSearchParams,
): Attribution {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const out: Attribution = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key)?.trim();
    if (v) out[key] = v.slice(0, 80);
  }
  const from =
    params.get("from")?.trim() ||
    params.get("ref")?.trim() ||
    params.get("referrer_report_id")?.trim();
  if (isReportId(from)) out.referrer_report_id = from;
  return out;
}

export function parseAttributionCookie(
  raw: string | null | undefined,
): Attribution {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return pickAttribution(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

export function serializeAttributionCookie(attr: Attribution): string {
  return JSON.stringify(pickAttribution(attr));
}

/** First-touch wins — later UTMs do not overwrite a stored visit. */
export function mergeAttribution(
  existing: Attribution,
  incoming: Attribution,
): Attribution {
  const out: Attribution = { ...existing };
  for (const key of [
    ...UTM_KEYS,
    "referrer_report_id",
    "lang",
    "country",
  ] as const) {
    const next = incoming[key];
    if (next && !out[key]) out[key] = next;
  }
  return out;
}

export function pickAttribution(
  raw: Record<string, unknown> | Attribution,
): Attribution {
  const out: Attribution = {};
  const lang = typeof raw.lang === "string" ? langFromAccept(raw.lang) : undefined;
  const country =
    typeof raw.country === "string" ? raw.country.trim().toUpperCase() : "";
  if (lang) out.lang = lang;
  if (/^[A-Z]{2}$/.test(country)) out.country = country;
  for (const key of UTM_KEYS) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 80);
  }
  const ref =
    typeof raw.referrer_report_id === "string" ? raw.referrer_report_id : "";
  if (isReportId(ref)) out.referrer_report_id = ref;
  return out;
}

export function attributionFromHeaders(headers: {
  get(name: string): string | null;
}): Attribution {
  return pickAttribution({
    lang: headers.get("accept-language") ?? undefined,
    country: headers.get("x-vercel-ip-country") ?? undefined,
  });
}

export function compactAttribution(attr: Attribution): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attr)) {
    if (v) out[k] = v;
  }
  return out;
}
