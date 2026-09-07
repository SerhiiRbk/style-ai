import assert from "node:assert/strict";
import test from "node:test";
import { planReportLookContexts } from "./report-look-plan";
import { lookOccasionIdFromContext } from "./look-contexts";

const base = { goals: [] as string[], lifestyle: [] as string[], occupation: "" };

test("plan is deterministic, distinct and exactly `count` long", () => {
  const p = { ...base, goals: ["Dating & social"], lifestyle: ["Public speaking"], occupation: "Creator" };
  const a = planReportLookContexts(p, null, 6);
  const b = planReportLookContexts(p, null, 6);
  assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id));
  assert.equal(a.length, 6);
  assert.equal(new Set(a.map((c) => c.id)).size, 6);
});

test("signals pull the client's real occasions forward", () => {
  const speakerDating = planReportLookContexts(
    { ...base, goals: ["Dating & social"], lifestyle: ["Public speaking"], occupation: "Content creator" },
    null,
    6,
  ).map((c) => c.id);
  assert.ok(speakerDating.includes("dinner"), "dating → dinner");
  assert.ok(speakerDating.includes("business_social"), "speaking → business social");
  assert.ok(speakerDating.includes("cultural"), "creator → cultural");
  const lawyer = planReportLookContexts({ ...base, occupation: "Corporate lawyer" }, null, 3).map((c) => c.id);
  assert.equal(lawyer[0], "work");
});

test("multi-look plans always keep a relaxed and a polished anchor; one look is smart casual", () => {
  const six = planReportLookContexts({ ...base, goals: ["Party / night out"] }, null, 6).map((c) => c.id);
  assert.ok(six.includes("smart_casual"));
  assert.ok(six.includes("weekend"));
  assert.ok(six.includes("work") || six.includes("business_social"));
  assert.deepEqual(planReportLookContexts(base, null, 1).map((c) => c.id), ["smart_casual"]);
  assert.deepEqual(planReportLookContexts(base, null, 0), []);
});

test("every planned context string resolves back to its own occasion id", () => {
  for (const ctx of planReportLookContexts({ ...base, goals: ["Travel more"] }, null, 9)) {
    assert.equal(lookOccasionIdFromContext(ctx.context), ctx.id, ctx.context);
  }
});
