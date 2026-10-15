import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIENT_FUNNEL_EVENTS,
  FUNNEL_EVENTS,
  compactAttribution,
  isClientFunnelEvent,
  isFunnelEvent,
  isReportId,
  langFromAccept,
  mergeAttribution,
  parseAttributionCookie,
  parseAttributionFromSearch,
  serializeAttributionCookie,
} from "./funnel";

test("funnel event list covers the launch steps in order", () => {
  assert.deepEqual([...FUNNEL_EVENTS], [
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
  ]);
  for (const name of FUNNEL_EVENTS) assert.equal(isFunnelEvent(name), true);
  assert.equal(isFunnelEvent("wizard_viewed"), false);
});

test("client whitelist includes colours_view and existing colour events", () => {
  assert.ok(CLIENT_FUNNEL_EVENTS.includes("colours_view"));
  assert.ok(isClientFunnelEvent("colours_started"));
  assert.equal(isClientFunnelEvent("credits_purchased"), false);
});

test("parseAttributionFromSearch keeps first-touch UTM and a report id", () => {
  const attr = parseAttributionFromSearch(
    "utm_source=hn&utm_medium=social&utm_campaign=launch&from=64510d11-8119-444b-a610-b0393006f3a8",
  );
  assert.equal(attr.utm_source, "hn");
  assert.equal(attr.utm_medium, "social");
  assert.equal(attr.utm_campaign, "launch");
  assert.equal(attr.referrer_report_id, "64510d11-8119-444b-a610-b0393006f3a8");
  assert.equal(isReportId("not-a-uuid"), false);
});

test("mergeAttribution is first-touch: later UTMs do not overwrite", () => {
  const first = parseAttributionFromSearch("utm_source=hn&utm_campaign=show");
  const later = parseAttributionFromSearch(
    "utm_source=google&utm_medium=cpc&from=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  );
  const merged = mergeAttribution(first, later);
  assert.equal(merged.utm_source, "hn");
  assert.equal(merged.utm_campaign, "show");
  assert.equal(merged.utm_medium, "cpc");
  assert.equal(merged.referrer_report_id, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
});

test("attribution cookie round-trips and drops junk", () => {
  const raw = serializeAttributionCookie({
    utm_source: "hn",
    lang: "en-US",
    country: "CZ",
    referrer_report_id: "64510d11-8119-444b-a610-b0393006f3a8",
  });
  const parsed = parseAttributionCookie(raw);
  assert.equal(parsed.utm_source, "hn");
  assert.equal(parsed.country, "CZ");
  assert.equal(parsed.lang, "en-us");
  assert.equal(parseAttributionCookie("not-json").utm_source, undefined);
  assert.deepEqual(compactAttribution({ utm_source: "hn", lang: "" }), {
    utm_source: "hn",
  });
});

test("langFromAccept takes the first tag", () => {
  assert.equal(langFromAccept("cs-CZ,cs;q=0.9,en;q=0.8"), "cs-cz");
  assert.equal(langFromAccept(null), undefined);
});
