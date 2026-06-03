import { SAMPLES } from "./scripts/feeds/sources.mjs";
import { importFeed } from "./scripts/feeds/run.mjs";

const remaining = [
  "impact", "shareasale", "gmc", "webgains",
  "flexoffers", "avantlink", "partnerize", "scraper",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fx = process.env.FX_RATES ? JSON.parse(process.env.FX_RATES) : undefined;

let total = 0;
for (const key of remaining) {
  let ok = false;
  for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
    try {
      const s = await importFeed({ sourceKey: key, file: SAMPLES[key], dryRun: false, fxRates: fx });
      total += s.upserted ?? 0;
      ok = true;
      console.log(`✓ ${key.padEnd(11)} upserted=${s.upserted} (attempt ${attempt})`);
    } catch (e) {
      const rl = /rate-limit/i.test(e.message);
      console.log(`… ${key.padEnd(11)} attempt ${attempt} ${rl ? "rate-limited" : "failed"}`);
      if (attempt < 4) await sleep(45000);
    }
  }
  if (!ok) console.log(`✗ ${key.padEnd(11)} gave up`);
  await sleep(15000);
}
console.log(`\nRETRY_DONE upserted=${total}`);
