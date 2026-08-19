/**
 * Aesthetic presets for Create-a-Look. Occasion + season + boldness stay
 * independent; a style, when chosen, steers silhouette, fabric and codes
 * inside the client's existing colour palette.
 *
 * Safe to import from client (picker) and server (prompt).
 */
export type LookStyle = {
  id: string;
  label: string;
  desc: string;
  /** Empty for the default — composeLookBrief then adds nothing. */
  brief: string;
};

export const DEFAULT_LOOK_STYLE_ID = "atelier";

export const LOOK_STYLES: LookStyle[] = [
  {
    id: "atelier",
    label: "Atelier",
    desc: "Let the occasion lead — no extra aesthetic.",
    brief: "",
  },
  {
    id: "riviera",
    label: "Riviera",
    desc: "Italian holiday tailoring — Capri, not the office.",
    brief:
      "Aesthetic: Italian Riviera tailoring (Mediterranean resort elegance). " +
      "High-waist gurkha or double-pleated trousers, linen and seersucker, safari or " +
      "unstructured jackets, knitted polo or camp-collar shirt, Belgian or tassel loafers. " +
      "Holiday sprezzatura — Portofino / St. Tropez energy, not a city suit. " +
      "No sneakers, no corporate two-piece, no office merino-and-tote. " +
      "Stay inside the client's BEST colours; do not invent extra-bright resort hues.",
  },
  {
    id: "nordic",
    label: "Nordic",
    desc: "Scandinavian quiet luxury — clean, quiet, expensive.",
    brief:
      "Aesthetic: Scandinavian quiet luxury. Clean lines, fine merino or cashmere, " +
      "unstructured wool, minimal hardware, no logos. Matte fabrics, precise fit, " +
      "almost no pattern. Quiet and expensive — Arket / Loro-adjacent, never flashy. " +
      "No gurkha theatrics, no safari jackets, no velvet, no seersucker stripes. " +
      "Colours stay in the client's BEST palette; prefer the quieter swatches for " +
      "the main garments and one considered accent.",
  },
  {
    id: "city_formal",
    label: "City formal",
    desc: "London city — worsted, oxford, structured.",
    brief:
      "Aesthetic: London city formal. Worsted or flannel trousers, oxford or poplin " +
      "shirt, structured blazer or suit jacket, derbies or oxfords, a proper belt. " +
      "City dress codes, not holiday. No linen shorts, no safari, no Belgian loafers " +
      "without socks, no knitted polo as the hero. A knit only under a jacket. " +
      "Stay on the client's BEST colours — charcoal/navy only if they appear there.",
  },
  {
    id: "milanese",
    label: "Milanese",
    desc: "Urban Italian elegance — soft, not resort.",
    brief:
      "Aesthetic: Milanese city elegance. Soft Italian construction — light or " +
      "unlined blazer, spread-collar shirt, elegant trousers (single pleat or plain), " +
      "loafers or sleek derbies. Urban la bella figura, not a beach holiday: no " +
      "seersucker, no safari, no gurkha showpiece. Texture over logos. " +
      "Stay inside the client's BEST colours.",
  },
  {
    id: "ivy",
    label: "Ivy",
    desc: "American prep — oxford, blazer, loafers.",
    brief:
      "Aesthetic: American Ivy / prep. Oxford-cloth button-down, navy or earth blazer, " +
      "chinos or grey-flannel trousers, penny loafers or simple derbies, a knit tie or " +
      "no tie. Understated campus-to-town, never costume preppy (no loud whales, no " +
      "novelty prints). Stay inside the client's BEST colours.",
  },
  {
    id: "heritage_knit",
    label: "Heritage knit",
    desc: "British interwar knitwear — Shetland, Fair Isle, 1930s sporting.",
    brief:
      "Aesthetic: British interwar heritage knitwear (1920s–40s sporting country). " +
      "The hero is a knit: Shetland or Fair Isle crew, fishermen's rib, shawl-collar " +
      "cardigan, ribbed slipover, or a submariner roll-neck. Pair with high-waist " +
      "pleated flannel or tweed trousers, a simple oxford or none, brogues or derbies. " +
      "Made-to-last British country, not city formal and not quiet-luxury merino as the " +
      "whole look. No sneakers, no safari, no gurkha showpiece, no costume fancy-dress. " +
      "Keep Fair Isle / rib / shawl collar as silhouette — map every colour to the " +
      "client's BEST palette, do not invent off-season vintage brights.",
  },
  {
    id: "high_waist",
    label: "High-waist",
    desc: "Italian high-rise — gurkha, double pleat, no belt.",
    brief:
      "Aesthetic: contemporary Italian high-waist tailoring. The hero is the " +
      "trouser: high-rise gurkha with side buckles (no belt), Hollywood waist, or " +
      "double-pleated high-waist trousers — linen, wool, or cotton. Pair with a " +
      "simple shirt, knitted polo, or fine crew, loafers, a tucked silhouette that " +
      "shows the waist. Year-round Italian proportion, not a beach holiday and not " +
      "a city suit: no safari jacket, no seersucker costume, no camp-collar as the " +
      "whole look, no sneakers, no low-rise slim jean. Stay inside the client's BEST " +
      "colours; do not invent extra-bright resort hues.",
  },
  {
    id: "edinburgh",
    label: "Edinburgh",
    desc: "Scottish tweed — soft jacket, earthy check, town not estate.",
    brief:
      "Aesthetic: contemporary Scottish tweed (Edinburgh / Walker Slater energy). " +
      "The hero is a soft, almost unstructured tweed jacket or three-piece — Harris " +
      "or Borders cloth, earthy check or herringbone, lightweight enough for town. " +
      "Pair with flannel or tweed trousers, a simple oxford or roll-neck, brogues or " +
      "derbies. Carelessly elegant, landscape colours, wearable in the city. Not a " +
      "shooting-party costume: no plus-fours, no deerstalker, no thornproof country " +
      "kit. Not London city worsted, not Ivy prep, not a knit-as-hero look. " +
      "Stay inside the client's BEST colours — translate the check into their palette, " +
      "do not invent off-palette heather brights.",
  },
  {
    id: "sartorial",
    label: "Sartorial",
    desc: "Italian classic menswear — grenadine, cut-away, pocket square.",
    brief:
      "Aesthetic: classic Italian sartorial menswear (Viola Milano / handmade-tie energy). " +
      "The heroes are the accessories: a grenadine, madder, or knit silk tie; a cut-away " +
      "or contrast-collar shirt; a pocket square. Jacket is a sport coat or double-breasted " +
      "flannel, trousers elegant, Belgian or string loafers, over-the-calf socks. Dressed, " +
      "not quiet: a tie is required. Not soft tie-less Milanese, not London city oxfords, " +
      "not Ivy button-down, not Pitti costume (no loud novelty socks, no stacked bracelets). " +
      "Stay inside the client's BEST colours — map silk and square to their palette.",
  },
  {
    id: "continental",
    label: "Continental",
    desc: "European slim suit — closer cut, waistcoat, fashion check.",
    brief:
      "Aesthetic: contemporary continental European slim suit (Prague / Paco Romano energy). " +
      "The hero is the suit as a whole: slim two-piece or three-piece with waistcoat, closer " +
      "jacket and trousers, fashion check or clean beige/olive/grey, turn-ups welcome. White " +
      "or light shirt, leather oxfords or derbies. Wedding, office, and evening in one " +
      "silhouette. Not London city classic proportions, not unlined Milanese separates, not " +
      "a gurkha-as-hero look, not holiday linen. Stay inside the client's BEST colours — " +
      "translate check or beige into their palette, do not invent off-palette wedding pastels.",
  },
  {
    id: "rive_gauche",
    label: "Rive Gauche",
    desc: "Left Bank Paris — roll-neck, navy, trench, slightly undone.",
    brief:
      "Aesthetic: Paris Rive Gauche (Saint-Germain intellectual). The mood is undone " +
      "Left Bank: a fine roll-neck or thin merino, navy blazer or caban, grey flannel or " +
      "dark trousers, a trench or pea coat, derbies or desert boots. Slightly loose, " +
      "scarf welcome, no tie required. Not Scandinavian quiet luxury (too clean, no " +
      "trench/scarf romance), not soft tie-less Milanese loafers, not Ivy button-down, " +
      "not a city two-piece. No sneakers as the hero, no gurkha, no costume beret. " +
      "Stay inside the client's BEST colours — navy/grey only if they appear there.",
  },
  {
    id: "breton",
    label: "Breton",
    desc: "French maritime — marinière, caban, navy stripe.",
    brief:
      "Aesthetic: French Breton / maritime (Saint-James, Channel coast). The heroes are " +
      "a marinière stripe knit or Breton shirt and a navy caban or ciré. Pair with " +
      "straight navy or stone trousers, simple deck or leather shoes — not a holiday " +
      "Italian look. Port and Normandy, not Capri: no safari, no gurkha, no camp-collar, " +
      "no seersucker, no costume sailor hat. Stripe is the accent, not a whole clown suit. " +
      "Stay inside the client's BEST colours — translate navy/cream stripe into their palette.",
  },
  {
    id: "open_knit",
    label: "Open knit",
    desc: "Summer mesh and crochet shirts — airy, not heritage wool.",
    brief:
      "Aesthetic: contemporary open-knit / crochet summer shirts. The hero is an airy " +
      "mesh, eyelet, or crochet button-up (or a lightweight jacquard knit polo), worn " +
      "solo or over a simple tee, with linen or cotton trousers. Warm-weather texture, " +
      "not heritage wool: no Shetland, no Fair Isle, no shawl-collar cardigan as the " +
      "whole look. Not quiet merino, not a Breton caban, not Italian safari tailoring. " +
      "No granny-square costume, no sneakers as the required hero. Stay inside the " +
      "client's BEST colours — map the openwork to their palette, do not invent neon " +
      "resort brights.",
  },
];

export function lookStyleById(
  id: string | undefined | null,
): LookStyle | undefined {
  if (!id) return undefined;
  return LOOK_STYLES.find((s) => s.id === id);
}

export function lookStyleIds(): string[] {
  return LOOK_STYLES.map((s) => s.id);
}

/** True when a style should add a prompt block (not the default atelier). */
export function lookStyleHasBrief(id: string | undefined | null): boolean {
  const s = lookStyleById(id);
  return Boolean(s?.brief);
}
