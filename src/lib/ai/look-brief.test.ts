import assert from "node:assert/strict";
import test from "node:test";
import {
  composeLookBrief,
  dinnerLayerMatchesSlot,
  LOOK_WEARABLE_RULE,
  partyJacketFabricDirective,
  partyJacketMatchesSlot,
  hasJacketHost,
  pocketSquareHasHost,
  sanitizeLookDescription,
  sanitizeLookItems,
  setVarietyDirective,
  stripHandheldProps,
  stripMisplacedPocketSquare,
  withWearableLookRule,
  workLookSlot,
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
  assert.match(result, /tote/i);
  assert.match(result, /briefcase|messenger|empty hands/i);
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

test("work conservative always requires a blazer or a shirt and tie — never ornamental knit as the outer layer", () => {
  const brief = composeLookBrief(BRIEF, {
    boldness: "conservative",
    occasionId: "work",
    lookIndex: 0,
    looksCount: 6,
  });
  assert.match(brief, /blazer|sport coat|necktie|shirt and a tie/i);
  assert.match(brief, /No Fair Isle|no Fair Isle|not Fair Isle/i);
});

test("work conservative slots stay jacket or shirt-and-tie across a 6-look set", () => {
  for (let i = 0; i < 6; i++) {
    const slot = workLookSlot(i, 6, "conservative");
    assert.ok(
      slot === "blazer" || slot === "shirt_tie" || slot === "blazer_knit",
      `conservative slot ${i} was ${slot}`,
    );
  }
});

test("work statement and experimental allow ornamental knit on some slots, more in a 9-look set", () => {
  const six = Array.from({ length: 6 }, (_, i) =>
    workLookSlot(i, 6, "experimental"),
  );
  const nine = Array.from({ length: 9 }, (_, i) =>
    workLookSlot(i, 9, "statement"),
  );
  const sixOrnamental = six.filter((s) => s === "ornamental_knit").length;
  const nineOrnamental = nine.filter((s) => s === "ornamental_knit").length;
  assert.ok(sixOrnamental >= 1 && sixOrnamental < 6);
  assert.ok(nineOrnamental > sixOrnamental);
  assert.match(
    composeLookBrief(BRIEF, {
      boldness: "statement",
      occasionId: "work",
      lookIndex: six.indexOf("ornamental_knit"),
      looksCount: 6,
    }),
    /Fair Isle|fisherman|ornamental/i,
  );
});

test("work moderate keeps ornamental knit rare — none in a 3-look set", () => {
  const three = Array.from({ length: 3 }, (_, i) =>
    workLookSlot(i, 3, "moderate"),
  );
  assert.equal(three.filter((s) => s === "ornamental_knit").length, 0);
  const nine = Array.from({ length: 9 }, (_, i) =>
    workLookSlot(i, 9, "moderate"),
  );
  assert.ok(nine.filter((s) => s === "ornamental_knit").length <= 1);
});

test("set variety is tighter at 3 looks and wider at 6 and 9", () => {
  const three = setVarietyDirective(0, 3);
  const six = setVarietyDirective(0, 6);
  const nine = setVarietyDirective(0, 9);
  assert.match(three, /3/);
  assert.match(three, /coherent/i);
  assert.match(six, /6/);
  assert.match(six, /distinct/i);
  assert.match(nine, /9/);
  assert.match(nine, /widely|range/i);
  assert.equal(setVarietyDirective(0, 1), "");
  assert.equal(setVarietyDirective(undefined, 6), "");
});

test("work × boldness moods are distinct and a jacket is not required on every adventurous look", () => {
  const conservative = composeLookBrief(BRIEF, {
    boldness: "conservative",
    occasionId: "work",
  });
  const adventurous = composeLookBrief(BRIEF, {
    boldness: "experimental",
    occasionId: "work",
  });
  const statement = composeLookBrief(BRIEF, {
    boldness: "statement",
    occasionId: "work",
  });
  assert.match(conservative, /blazer|necktie|shirt with a tie/i);
  assert.match(adventurous, /adventurous|motif|ornamental/i);
  assert.match(statement, /statement|focal/i);
  assert.notEqual(conservative, adventurous);
  assert.notEqual(adventurous, statement);
});

test("weekend and dinner boldness moods differ", () => {
  const weekendSafe = composeLookBrief(BRIEF, {
    boldness: "conservative",
    occasionId: "weekend",
  });
  const weekendBold = composeLookBrief(BRIEF, {
    boldness: "statement",
    occasionId: "weekend",
  });
  const dinnerSafe = composeLookBrief(BRIEF, {
    boldness: "conservative",
    occasionId: "dinner",
  });
  const dinnerBold = composeLookBrief(BRIEF, {
    boldness: "statement",
    occasionId: "dinner",
  });
  assert.match(weekendSafe, /neat casual|polo|chinos/i);
  assert.match(weekendBold, /bold|hero|pattern/i);
  assert.match(dinnerSafe, /jacket|dark/i);
  assert.match(dinnerBold, /evening|focal/i);
  assert.notEqual(weekendSafe, weekendBold);
  assert.notEqual(dinnerSafe, dinnerBold);
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

test("wearable rule asks for one chromatic hero and a dark anchor on mid-neutrals", () => {
  assert.match(LOOK_WEARABLE_RULE, /one chromatic hero/i);
  assert.match(LOOK_WEARABLE_RULE, /shoes must not match the jacket/i);
  assert.match(LOOK_WEARABLE_RULE, /mid-neutral|greige|mushroom/i);
});

test("wearable rule keeps mauve off blazers and overcoats", () => {
  assert.match(LOOK_WEARABLE_RULE, /navy|charcoal|grey/i);
  assert.match(LOOK_WEARABLE_RULE, /burgundy|olive/i);
  assert.match(LOOK_WEARABLE_RULE, /teal|mauve|sage/i);
  assert.match(LOOK_WEARABLE_RULE, /plum velvet/i);
  assert.match(LOOK_WEARABLE_RULE, /blazer|sport coat/i);
  assert.match(LOOK_WEARABLE_RULE, /overcoat/i);
});

test("wearable rule keeps shorts off jackets, knits and classic shoes", () => {
  assert.match(LOOK_WEARABLE_RULE, /shorts|bermudas/i);
  assert.match(LOOK_WEARABLE_RULE, /oxfords|brogues|derbies|boots/i);
  assert.match(LOOK_WEARABLE_RULE, /blazer|jumper|hoodie/i);
});

test("wearable rule forbids a necktie on a closed crewneck", () => {
  assert.match(LOOK_WEARABLE_RULE, /necktie|tie/i);
  assert.match(LOOK_WEARABLE_RULE, /crewneck|roll-neck|V-neck/i);
});

test("wearable rule forbids a jacket on a bare chest", () => {
  assert.match(LOOK_WEARABLE_RULE, /bare chest|bare skin/i);
  assert.match(LOOK_WEARABLE_RULE, /blazer|sport coat/i);
  assert.match(LOOK_WEARABLE_RULE, /shirt|polo|knit/i);
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

const CREWNECK_TIE_LOOK =
  "Light blue Fair Isle crew-neck wool sweater, white oxford shirt, " +
  "seafoam knitted tie, navy wool trousers, tan suede derbies";

test("sanitizeLookDescription rewrites a closed knit plus tie into a V-neck over the shirt", () => {
  const out = sanitizeLookDescription(CREWNECK_TIE_LOOK);
  assert.match(out, /V-neck/i);
  assert.match(out, /worn over the shirt and tie/i);
  assert.doesNotMatch(out, /crew[\s-]?neck/i);
  assert.match(out, /knitted tie/i);
  assert.match(out, /oxford shirt/i);
});

test("sanitizeLookDescription rewrites a plain jumper plus tie the same way", () => {
  const out = sanitizeLookDescription(
    "Slate blue merino jumper, greige tailored trousers, sage silk tie, chestnut brogues",
  );
  assert.match(out, /V-neck jumper/i);
  assert.match(out, /worn over the shirt and tie/i);
  assert.doesNotMatch(out, /crew[\s-]?neck/i);
  assert.match(out, /silk tie/i);
});

test("sanitizeLookDescription leaves a V-neck or cardigan with a tie in place", () => {
  assert.match(
    sanitizeLookDescription(
      "Sage V-neck merino jumper, ivory shirt, navy knitted tie, charcoal trousers",
    ),
    /V-neck merino jumper/i,
  );
  assert.match(
    sanitizeLookDescription(
      "Oatmeal cardigan, white shirt, grenadine tie, navy trousers",
    ),
    /cardigan/i,
  );
});

test("sanitizeLookDescription leaves a crewneck alone when there is no tie", () => {
  assert.equal(
    sanitizeLookDescription(
      "Light blue Fair Isle crew-neck wool sweater, navy wool trousers, tan suede derbies",
    ),
    "Light blue Fair Isle crew-neck wool sweater, navy wool trousers, tan suede derbies",
  );
});

const BARE_KNIT_BLAZER_LOOK =
  "Soft-teal knit blazer, dusty-rose chinos, muted-navy loafers, muted-navy belt, " +
  "slate-blue pocket square, greige leather tote";

test("sanitizeLookDescription puts a shirt under a blazer that has no base layer", () => {
  const out = sanitizeLookDescription(BARE_KNIT_BLAZER_LOOK);
  assert.match(out, /knit blazer/i);
  assert.match(out, /plain collared shirt/i);
  assert.match(out, /dusty-rose chinos/i);
  assert.match(out, /pocket square/i);
});

test("sanitizeLookDescription snaps a teal sport coat to navy and leaves a teal knit", () => {
  const out = sanitizeLookDescription(
    "Soft-teal sport coat, slate-blue crewneck knit, soft-charcoal wool trousers, muted-navy loafers",
  );
  assert.match(out, /navy sport coat/i);
  assert.doesNotMatch(out, /teal sport coat|teal knit blazer/i);
  assert.match(out, /teal|slate-blue crewneck/i);
  assert.match(
    sanitizeLookDescription(
      "Navy unstructured blazer, teal merino crewneck, greige chinos, loafers",
    ),
    /teal merino crewneck/i,
  );
});

test("sanitizeLookDescription snaps a sage blazer and a work burgundy jacket", () => {
  const sage = sanitizeLookDescription(
    "Sage wool-blend blazer, white oxford shirt, charcoal trousers",
  );
  assert.match(sage, /navy(?: wool-blend)? blazer/i);
  assert.doesNotMatch(sage, /sage/i);
  const dinner = sanitizeLookDescription(
    "Burgundy velvet blazer, white dress shirt, black trousers",
    "dinner",
  );
  assert.match(dinner, /burgundy velvet blazer/i);
  const work = sanitizeLookDescription(
    "Burgundy velvet blazer, white oxford shirt, charcoal trousers",
    "work",
  );
  assert.match(work, /navy velvet blazer/i);
  assert.doesNotMatch(work, /burgundy velvet blazer/i);
});

test("sanitizeLookDescription keeps a plum velvet jacket on party statement only", () => {
  const party = sanitizeLookDescription(
    "Plum velvet blazer, white dress shirt, black trousers",
    "party",
    "statement",
  );
  assert.match(party, /plum velvet blazer/i);
  const wool = sanitizeLookDescription(
    "Plum wool-blend blazer, white dress shirt, black trousers",
    "party",
    "experimental",
  );
  assert.match(wool, /plum velvet blazer/i);
  assert.doesNotMatch(wool, /wool-blend/i);
  const moderate = sanitizeLookDescription(
    "Plum velvet blazer, white dress shirt, black trousers",
    "party",
    "moderate",
  );
  assert.match(moderate, /navy velvet blazer/i);
  const dinner = sanitizeLookDescription(
    "Plum velvet blazer, white dress shirt, black trousers",
    "dinner",
    "statement",
  );
  assert.match(dinner, /navy velvet blazer/i);
});

test("sanitizeLookDescription leaves a blazer that already has a shirt or knit", () => {
  const withShirt =
    "Navy wool blazer, white oxford shirt, charcoal trousers, chestnut derbies";
  assert.equal(sanitizeLookDescription(withShirt), withShirt);
  const withKnit =
    "Navy unstructured blazer, teal merino crewneck, greige chinos, loafers";
  assert.equal(sanitizeLookDescription(withKnit), withKnit);
});

test("sanitizeLookDescription puts a shirt under a coat with no base layer", () => {
  const out = sanitizeLookDescription(
    "Charcoal tailored overcoat, navy trousers, black oxfords",
  );
  assert.match(out, /overcoat/i);
  assert.match(out, /plain collared shirt/i);
  assert.doesNotMatch(out, /plain collared shirt.*plain collared shirt/i);
});

test("dinner slot 0 names a shirt or knit under the blazer", () => {
  const brief = composeLookBrief(BRIEF, {
    occasionId: "dinner",
    lookIndex: 0,
    looksCount: 3,
  });
  assert.match(brief, /shirt|knit/i);
  assert.match(brief, /bare/i);
});

const WORK_TOTE_LOOK =
  "Navy wool blazer, white oxford shirt, charcoal trousers, chestnut derbies, dusty rose canvas tote bag";

test("sanitizeLookDescription drops a tote on work and formal looks", () => {
  const work = sanitizeLookDescription(WORK_TOTE_LOOK, "work");
  assert.doesNotMatch(work, /tote/i);
  assert.match(work, /blazer/i);
  assert.match(work, /derbies/i);
  const formal = sanitizeLookDescription(WORK_TOTE_LOOK, "formal");
  assert.doesNotMatch(formal, /tote/i);
});

test("sanitizeLookDescription keeps a tote on weekend and when occasion is omitted", () => {
  assert.match(sanitizeLookDescription(WORK_TOTE_LOOK, "weekend"), /tote/i);
  assert.match(sanitizeLookDescription(WORK_TOTE_LOOK), /tote/i);
});

test("sanitizeLookItems drops a tote slot on work looks", () => {
  const items = [
    { garment: "blazer", color: "navy" },
    { garment: "tote bag", color: "dusty rose" },
    { garment: "trousers", color: "charcoal" },
  ];
  const description = sanitizeLookDescription(
    "Navy blazer, dusty rose tote bag, charcoal trousers",
    "work",
  );
  assert.deepEqual(sanitizeLookItems(items, description, "work"), [
    { garment: "blazer", color: "navy" },
    { garment: "trousers", color: "charcoal" },
  ]);
});

test("sanitizeLookItems rewrites a crewneck slot when the look also has a tie", () => {
  const items = [
    { garment: "crewneck sweater", color: "slate" },
    { garment: "knitted tie", color: "seafoam" },
    { garment: "trousers", color: "navy" },
  ];
  const description = sanitizeLookDescription(
    "Slate crewneck sweater, seafoam knitted tie, navy trousers",
  );
  assert.deepEqual(sanitizeLookItems(items, description), [
    { garment: "V-neck jumper", color: "slate" },
    { garment: "knitted tie", color: "seafoam" },
    { garment: "trousers", color: "navy" },
  ]);
});

test("formal and wedding briefs state the dress-code exception; work does not", () => {
  const formal = composeLookBrief("Sharp and occasion-appropriate.", { occasionId: "formal", boldness: "moderate" });
  assert.match(formal, /dress code .* beats colour analysis/i);
  assert.match(formal, /black or dark-brown dress shoes/i);
  assert.match(formal, /tailored overcoat/i);
  assert.match(formal, /keep black off the shirt/i);
  const wedding = composeLookBrief("Celebratory.", { occasionId: "wedding_guest", boldness: "moderate" });
  assert.match(wedding, /tailored overcoat/i);
  const work = composeLookBrief("Office.", { occasionId: "work", boldness: "moderate" });
  assert.doesNotMatch(work, /tailored overcoat/i);
  // Omitting occasion leaves the brief untouched by the formal note.
  assert.doesNotMatch(composeLookBrief("Plain."), /dress code/i);
});

test("dinner sets rotate an evening layer: blazer, textured jacket, then an evening top", () => {
  const b0 = composeLookBrief("Dinner.", { occasionId: "dinner", boldness: "moderate", lookIndex: 0, looksCount: 3 });
  const b1 = composeLookBrief("Dinner.", { occasionId: "dinner", boldness: "moderate", lookIndex: 1, looksCount: 3 });
  const b2 = composeLookBrief("Dinner.", { occasionId: "dinner", boldness: "moderate", lookIndex: 2, looksCount: 3 });
  assert.match(b0, /unstructured blazer or sport coat/i);
  assert.match(b1, /overshirt|knitted blazer|chore jacket/i);
  assert.match(b1, /Do NOT use a classic blazer/);
  assert.match(b2, /may go jacket-free/i);
  // A single extra look (no set index) and other occasions get no dinner rotation.
  assert.doesNotMatch(composeLookBrief("Dinner.", { occasionId: "dinner", boldness: "moderate" }), /Evening layer for THIS look/);
  assert.doesNotMatch(composeLookBrief("Work.", { occasionId: "work", lookIndex: 0, looksCount: 3 }), /Evening layer/);
});

test("dinnerLayerMatchesSlot demands a jacket-class layer on slots 0 and 1 only", () => {
  assert.equal(dinnerLayerMatchesSlot("Soft teal merino crewneck, navy chinos, loafers", 0), false);
  assert.equal(dinnerLayerMatchesSlot("Navy unstructured blazer, teal knit, chinos", 0), true);
  assert.equal(dinnerLayerMatchesSlot("Suede overshirt, slate shirt, charcoal trousers", 1), true);
  assert.equal(dinnerLayerMatchesSlot("Slate blue shirt, charcoal chinos, plum loafers", 1), false);
  assert.equal(dinnerLayerMatchesSlot("Fine merino polo, greige trousers, loafers", 2), true);
});
