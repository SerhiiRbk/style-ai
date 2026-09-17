import assert from "node:assert/strict";
import test from "node:test";
import {
  abandonedIntakeEmail,
  day3AfterReportEmail,
  welcomeEmail,
} from "./templates";

test("welcome email explains 6 credits and that Lookbook is paid", () => {
  const mail = welcomeEmail({
    ctaUrl: "https://www.valetti.fit/start",
    lookbookUrl: "https://www.valetti.fit/pricing",
  });
  assert.match(mail.subject, /6 Valetti credits/);
  assert.match(mail.text, /Starter Report uses 5/);
  assert.match(mail.text, /Lookbook is paid/);
  assert.match(mail.html, /Create my Starter Report/);
});

test("abandoned-intake email asks to finish, not to buy", () => {
  const mail = abandonedIntakeEmail({
    ctaUrl: "https://www.valetti.fit/start",
    unsubscribeUrl: "https://www.valetti.fit/unsubscribe?e=a&t=b",
  });
  assert.match(mail.subject, /two minutes left/i);
  assert.match(mail.text, /uploaded a photo/);
  assert.match(mail.html, /Unsubscribe/);
});

test("day-3 email points at the report and try-on", () => {
  const mail = day3AfterReportEmail({
    reportUrl: "https://www.valetti.fit/report/abc",
    unsubscribeUrl: "https://www.valetti.fit/unsubscribe?e=a&t=b",
  });
  assert.match(mail.subject, /Three looks/);
  assert.match(mail.text, /try-on/);
  assert.match(mail.html, /Open my report/);
});
