import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LOOK_STYLE_ID,
  LOOK_STYLES,
  lookStyleById,
  lookStyleHasBrief,
} from "./look-styles";

test("atelier is the default and has no prompt brief", () => {
  assert.equal(DEFAULT_LOOK_STYLE_ID, "atelier");
  const atelier = lookStyleById("atelier");
  assert.ok(atelier);
  assert.equal(atelier.brief, "");
  assert.equal(lookStyleHasBrief("atelier"), false);
  assert.equal(lookStyleHasBrief("riviera"), true);
});

test("named styles cover riviera, nordic and city formal", () => {
  const ids = new Set(LOOK_STYLES.map((s) => s.id));
  for (const id of [
    "atelier",
    "riviera",
    "nordic",
    "city_formal",
    "milanese",
    "ivy",
    "heritage_knit",
    "high_waist",
    "edinburgh",
    "sartorial",
    "continental",
    "rive_gauche",
    "breton",
    "open_knit",
  ]) {
    assert.ok(ids.has(id), `missing ${id}`);
  }
  assert.match(lookStyleById("riviera")!.brief, /Riviera|linen|loafer/i);
  assert.match(lookStyleById("nordic")!.brief, /quiet luxury|merino|cashmere/i);
  assert.match(lookStyleById("city_formal")!.brief, /London|worsted|derby/i);
  assert.match(lookStyleById("heritage_knit")!.brief, /Shetland|Fair Isle|shawl-collar/i);
  assert.match(lookStyleById("high_waist")!.brief, /gurkha|Hollywood waist|high-rise/i);
  assert.match(lookStyleById("edinburgh")!.brief, /tweed|Harris|Edinburgh/i);
  assert.match(lookStyleById("sartorial")!.brief, /grenadine|cut-away|pocket square/i);
  assert.match(lookStyleById("continental")!.brief, /slim|waistcoat|three-piece/i);
  assert.match(lookStyleById("rive_gauche")!.brief, /Rive Gauche|roll-neck|trench/i);
  assert.match(lookStyleById("breton")!.brief, /marinière|caban|Breton/i);
  assert.match(lookStyleById("open_knit")!.brief, /open-knit|crochet|mesh/i);
});

test("unknown style id is undefined", () => {
  assert.equal(lookStyleById("cyberpunk"), undefined);
});
