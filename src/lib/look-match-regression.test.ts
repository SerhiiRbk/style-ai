import assert from "node:assert/strict";
import test from "node:test";
import { LOOK_MATCH_REGRESSION } from "./look-match-regression";
import { rankLookSlot } from "./look-match-rank";

test("matching golden-set: winner is an accepted product, never a rejected one", () => {
  const failures: string[] = [];
  for (const c of LOOK_MATCH_REGRESSION) {
    const ranked = rankLookSlot(c.pool, c.slot, {
      occasionId: c.occasionId,
      styleId: c.styleId,
      boldness: c.boldness ?? "moderate",
    });
    const winner = ranked[0];
    if (!winner) {
      failures.push(`${c.id}: empty ranking (${c.why})`);
      continue;
    }
    if (!c.acceptIds.includes(winner.id)) {
      failures.push(
        `${c.id}: got ${winner.id} (${winner.title}), expected one of ${c.acceptIds.join(",")} — ${c.why}`,
      );
    }
    if (c.rejectIds?.includes(winner.id)) {
      failures.push(`${c.id}: rejected winner ${winner.id} — ${c.why}`);
    }
  }
  assert.equal(failures.length, 0, failures.join("\n"));
});
