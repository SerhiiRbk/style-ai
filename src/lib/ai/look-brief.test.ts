import assert from "node:assert/strict";
import test from "node:test";
import {
  composeLookBrief,
  LOOK_WEARABLE_RULE,
  partyJacketFabricDirective,
  partyJacketMatchesSlot,
  hasJacketHost,
  pocketSquareHasHost,
  sanitizeLookDescription,
  sanitizeLookItems,
  stripHandheldProps,
  stripMisplacedPocketSquare,
  withWearableLookRule,
} from "./look-brief";

const BRIEF = "A relaxed weekend outfit for running errands.";
const BOLDNESS_VALUES = ["conservative", "moderate", "experimental", "statement"] as const;

test("omitting both boldness and season leaves the brief unchanged", () => {
  assert.equal(composeLookBrief(BRIEF), BRIEF);
  assert.equal(composeLookBrief(BRIEF, {}), BRIEF);
});

test("season alone prepends a season line and keeps the brief intact", () => {
  const result = composeLookBrief(BRIEF, { season: "winter" });
  assert.match(result, /Season: winter/);
  assert.ok(result.endsWith(BRIEF), "original brief text must be preserved verbatim");
});

for (const boldness of BOLDNESS_VALUES) {
  test(`strictness phrase is prepended for boldness="${boldness}"`, () => {
    const result = composeLookBrief(BRIEF, { boldness });
    assert.match(result, new RegExp(`Strictness: ${boldness}`));
    assert.ok(result.endsWith(BRIEF), "original brief text must be preserved verbatim");
  });
}

test("season + strictness compose together, season first", () => {
  const result = composeLookBrief(BRIEF, { boldness: "statement", season: "summer" });
  assert.match(result, /^Season: summer/, "season line should lead");
  assert.match(result, /Strictness: statement/);
  assert.ok(result.endsWith(BRIEF));
  assert.ok(
    result.indexOf("Season:") < result.indexOf("Strictness:"),
    "season note must precede the strictness note",
  );
});

test("work occasion pins a blue-or-white oxford, not a chromatic shirt", () => {
  const result = composeLookBrief(BRIEF, { occasionId: "work" });
  assert.match(result, /light-blue oxford/i);
  assert.match(result, /white oxford/i);
  assert.match(result, /Do not put a chromatic hero/i);
  assert.match(result, /tuck the shirt into the trousers/i);
  assert.ok(result.endsWith(BRIEF));
});

test("party × statement adds an after-dark mood and forbids office knit+tote", () => {
  const result = composeLookBrief(BRIEF, {
    boldness: "statement",
    season: "autumn",
    occasionId: "party",
  });
  assert.match(result, /PARTY STATEMENT/);
  assert.match(result, /after dark/i);
  assert.match(result, /tote/i);
  assert.match(result, /crewneck/i);
  assert.match(result, /evening jacket|after-dark layer/i);
  assert.ok(result.endsWith(BRIEF));
});

test("party look-index rotates jacket fabric and keeps velvet off looks 1 and 2", () => {
  const v = composeLookBrief(BRIEF, { occasionId: "party", lookIndex: 0 });
  const c = composeLookBrief(BRIEF, { occasionId: "party", lookIndex: 1 });
  const w = composeLookBrief(BRIEF, { occasionId: "party", lookIndex: 2 });
  assert.match(v, /velvet/i);
  assert.match(c, /corduroy|unstructured casual/i);
  assert.match(c, /Do NOT use velvet/);
  assert.match(w, /hopsack|tweed|suede/i);
  assert.match(w, /Do NOT use velvet or corduroy/);
  assert.equal(partyJacketFabricDirective(3), partyJacketFabricDirective(0));
  assert.equal(partyJacketMatchesSlot("Teal velvet blazer, silk shirt", 0), true);
  assert.equal(partyJacketMatchesSlot("Teal velvet blazer, silk shirt", 1), false);
  assert.equal(
    partyJacketMatchesSlot("Sage corduroy sport coat, dusty rose silk shirt", 1),
    true,
  );
});

test("riviera style injects a resort-tailoring brief; atelier does not", () => {
  const riviera = composeLookBrief(BRIEF, { styleId: "riviera" });
  assert.match(riviera, /Riviera|linen|loafer/i);
  assert.ok(riviera.endsWith(BRIEF));
  assert.match(composeLookBrief(BRIEF, { styleId: "heritage_knit" }), /Shetland|Fair Isle/i);
  assert.match(composeLookBrief(BRIEF, { styleId: "high_waist" }), /gurkha|high-rise/i);
  assert.match(composeLookBrief(BRIEF, { styleId: "edinburgh" }), /tweed|Harris|Edinburgh/i);
  assert.match(composeLookBrief(BRIEF, { styleId: "sartorial" }), /grenadine|cut-away/i);
  assert.match(composeLookBrief(BRIEF, { styleId: "continental" }), /slim|waistcoat/i);
  assert.match(composeLookBrief(BRIEF, { styleId: "rive_gauche" }), /Rive Gauche|roll-neck/i);
  assert.match(composeLookBrief(BRIEF, { styleId: "breton" }), /marinière|caban|Breton/i);
  assert.match(composeLookBrief(BRIEF, { styleId: "open_knit" }), /open-knit|crochet|mesh/i);
  assert.equal(composeLookBrief(BRIEF, { styleId: "atelier" }), BRIEF);
  assert.equal(composeLookBrief(BRIEF, { styleId: "unknown" }), BRIEF);
});

test("a named style skips the party velvet-fabric rotation", () => {
  const result = composeLookBrief(BRIEF, {
    occasionId: "party",
    lookIndex: 0,
    styleId: "nordic",
  });
  assert.match(result, /quiet luxury/i);
  assert.doesNotMatch(result, /Jacket fabric for THIS look: a velvet/i);
});

test("omitting occasionId leaves the weekend brief without party mood", () => {
  const result = composeLookBrief(BRIEF, { boldness: "statement" });
  assert.doesNotMatch(result, /PARTY STATEMENT/);
});

test("the four boldness strictness phrases are all distinct", () => {
  const phrases = BOLDNESS_VALUES.map(
    (b) => composeLookBrief(BRIEF, { boldness: b }).replace(BRIEF, ""),
  );
  assert.equal(new Set(phrases).size, phrases.length, "each Boldness value must yield a distinct strictness phrase");
});

test("wearable rule forbids handheld props and allows a normal bag", () => {
  assert.match(LOOK_WEARABLE_RULE, /wallet|cardholder/i);
  assert.match(LOOK_WEARABLE_RULE, /tote|backpack|briefcase/i);
  assert.match(LOOK_WEARABLE_RULE, /hand/i);
  assert.match(LOOK_WEARABLE_RULE, /shoes must clearly contrast/i);
});

test("wearable rule keeps pocket squares off jumpers", () => {
  assert.match(LOOK_WEARABLE_RULE, /pocket square/i);
  assert.match(LOOK_WEARABLE_RULE, /blazer/i);
  assert.match(LOOK_WEARABLE_RULE, /jumper|sweater|crewneck/i);
});

test("withWearableLookRule appends the wearable rule and keeps the brief", () => {
  const result = withWearableLookRule(BRIEF);
  assert.ok(result.startsWith(BRIEF));
  assert.ok(result.includes(LOOK_WEARABLE_RULE));
  assert.notEqual(result, BRIEF);
});

test("stripHandheldProps drops wallets and phones, keeps a tote", () => {
  assert.equal(
    stripHandheldProps(
      "Dusty rose merino crewneck, muted navy trousers, sage chukka boots, greige leather cardholder",
    ),
    "Dusty rose merino crewneck, muted navy trousers, sage chukka boots",
  );
  assert.equal(
    stripHandheldProps("Soft teal velvet blazer, charcoal trousers, greige leather wallet"),
    "Soft teal velvet blazer, charcoal trousers",
  );
  assert.equal(
    stripHandheldProps("Slate blue jumper, greige trousers, phone in hand, greige leather tote bag"),
    "Slate blue jumper, greige trousers, greige leather tote bag",
  );
});

test("stripHandheldProps is a no-op on empty or already-clean descriptions", () => {
  assert.equal(stripHandheldProps(""), "");
  assert.equal(
    stripHandheldProps("Navy blazer, cream knit, charcoal trousers, brown loafers"),
    "Navy blazer, cream knit, charcoal trousers, brown loafers",
  );
});

const JUMPER_LOOK =
  "Slate blue fine-knit merino crew-neck jumper, greige tailored wool trousers, " +
  "soft teal silk pocket square, sage suede Chelsea boots, greige leather tote bag";

test("hasJacketHost recognises blazers and ignores shirt-only looks", () => {
  assert.equal(hasJacketHost("Soft teal velvet blazer, dusty rose silk shirt"), true);
  assert.equal(hasJacketHost("Soft teal silk shirt, greige trousers, dusty rose pocket square"), false);
});

test("pocket square has a host only on a blazer, not a shirt-only look", () => {
  assert.equal(pocketSquareHasHost("Soft teal velvet blazer, dusty rose knit, teal pocket square"), true);
  assert.equal(pocketSquareHasHost("Sage linen shirt, navy trousers, teal linen pocket square"), false);
  assert.equal(pocketSquareHasHost("Oxford button-down, charcoal trousers, ivory pocket square"), false);
  assert.equal(pocketSquareHasHost(JUMPER_LOOK), false);
  assert.equal(
    pocketSquareHasHost("Linen shirt, merino jumper, navy trousers, teal pocket square"),
    false,
  );
});

test("stripMisplacedPocketSquare drops a square on a jumper-only look", () => {
  assert.equal(
    stripMisplacedPocketSquare(JUMPER_LOOK),
    "Slate blue fine-knit merino crew-neck jumper, greige tailored wool trousers, " +
      "sage suede Chelsea boots, greige leather tote bag",
  );
  assert.equal(
    stripMisplacedPocketSquare("Soft teal velvet blazer, charcoal trousers, teal silk pocket square"),
    "Soft teal velvet blazer, charcoal trousers, teal silk pocket square",
  );
  assert.equal(
    stripMisplacedPocketSquare(
      "Soft teal poplin shirt, muted navy trousers, slate blue linen pocket square, greige briefcase",
    ),
    "Soft teal poplin shirt, muted navy trousers, greige briefcase",
  );
});

test("sanitizeLookDescription strips wallets and orphan pocket squares", () => {
  assert.equal(
    sanitizeLookDescription(`${JUMPER_LOOK}, greige leather cardholder`),
    "Slate blue fine-knit merino crew-neck jumper, greige tailored wool trousers, " +
      "sage suede Chelsea boots, greige leather tote bag",
  );
});

test("sanitizeLookItems drops handheld props and a hostless pocket square", () => {
  const items = [
    { garment: "pocket square", color: "cream" },
    { garment: "wallet", color: null },
    { garment: "crewneck knit", color: "sage" },
  ];
  // No jacket in the description → the square goes; the wallet always goes.
  assert.deepEqual(
    sanitizeLookItems(items, "Sage crewneck knit, stone chinos"),
    [{ garment: "crewneck knit", color: "sage" }],
  );
  // With a blazer host the square stays.
  assert.deepEqual(
    sanitizeLookItems(items, "Navy blazer, sage crewneck knit"),
    [
      { garment: "pocket square", color: "cream" },
      { garment: "crewneck knit", color: "sage" },
    ],
  );
  // Nothing survives → undefined (signals "no structured slots").
  assert.equal(sanitizeLookItems([{ garment: "wallet" }], "Chinos"), undefined);
  assert.equal(sanitizeLookItems(undefined, "Chinos"), undefined);
});
