# Affiliate product feeds

How StyleAI Consultant fills its product catalogue, how to test importers right
now, and what each affiliate network needs (keys, approval, feed format).

---

## 1. How it works

Every feed — affiliate network or scraper — is mapped into **one canonical
product format** (`scripts/feeds/schema.mjs`). Nothing downstream changes when
you add a new source.

```
feed (CSV / pipe / XML / JSON)
   → parse            scripts/feeds/parse.mjs
   → map to canonical scripts/feeds/adapter.mjs + sources.mjs
   → validate (Zod)   scripts/feeds/schema.mjs
   → embed + upsert   scripts/feeds/upsert.mjs  → Supabase `products` (pgvector)
```

Dedup key: `(source, external_id)` — re-running a feed updates rows in place.
Prices are normalised to EUR (`priceEur`) for budget filtering; categories are
mapped to a fixed enum; gender/colour are inferred when missing.

**Canonical fields:** `source, externalId, sku, brand, title, description,
category, gender, color, colorHex, price, currency, priceEur, imageUrl,
deeplink, inStock, attrs`.

---

## 2. Test the importers right now (no keys needed)

Realistic sample feeds live in `data/feeds/samples/`. Run every adapter in
dry-run (parses, maps, validates, prints samples — no embeddings, no DB):

```bash
npm run import:feed:test
```

Test one source / one file:

```bash
node scripts/import-feed.mjs --source awin --file data/feeds/samples/awin.csv --dry-run --limit 5
```

Once you have a **real feed URL or file** (after approval below), the same
command ingests live data — drop `--dry-run` to embed + write to the DB:

```bash
# real data, still safe to inspect first:
node --env-file=.env.local scripts/import-feed.mjs --source awin --url "$AWIN_FEED_URL" --dry-run
# then ingest:
npm run import:feed -- --source awin --url "$AWIN_FEED_URL"
```

Requires for live ingest: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`AI_GATEWAY_API_KEY` (embeddings), and migrations `0001` + `0002` applied.
Optional `FX_RATES` (JSON, units per 1 EUR) to override the built-in FX table.

---

## 3. Networks

> Cost: joining these networks and accessing feeds is **free** — you earn a
> commission per sale. The real barrier is **approval** (per-advertiser), which
> usually needs a live website/domain.

### Awin  — `--source awin`
- **Covers:** Zalando, ASOS, Mango, COS/Arket (H&M group), and hundreds of EU brands.
- **Sign up:** <https://www.awin.com/> → Publisher account. (Historically a refundable €5/£5 verification deposit, credited back to your balance.)
- **Approval:** apply to each advertiser ("Join programme"); approval ranges from instant to a few days. A working site/domain helps.
- **Get the feed:** Dashboard → **Toolbox → Create-a-Feed**. Choose advertisers + columns, get a personal download URL (your publisher ID is embedded).
- **API key:** for the *Publisher API* (stats/commissions) you generate an **OAuth2 token** under Account → API credentials. Not required for product feeds.
- **Format:** CSV (`,`), gzipped, standard column names (`aw_deep_link`, `product_name`, `search_price`, `merchant_image_url`, `brand_name`, `colour`, `currency`, `in_stock`, …).
- **Env:** `AWIN_FEED_URL`

### Zalando Partner Program  — `--source zalando`
- **Note:** In the EU, Zalando's affiliate programme runs **through Awin**, so the feed layout is identical to Awin (this adapter just tags rows `zalando:*`).
- **Sign up / approval:** join Zalando inside Awin (<https://www.awin.com/>); apply to the Zalando programme.
- **Direct partner enquiries:** <https://www.zalando.com/partner/> (for larger/B2B deals).
- **Format / env:** same as Awin. `ZALANDO_FEED_URL`

### Rakuten Advertising  — `--source rakuten`
- **Covers:** many premium/heritage brands (Reiss, Sunspel, etc.), strong in US/UK + EU.
- **Sign up:** <https://rakutenadvertising.com/> → Publishers. Free.
- **Approval:** apply per advertiser; some auto-approve, others review.
- **Get the feed:** Publisher dashboard → **Product Feeds** (download link / FTP). Also offers a **Product Search API** (needs API token under Account → Web Services).
- **API key:** for the Product Search/Coupon APIs, request a token in the dashboard. Not needed for downloadable feeds.
- **Format:** pipe-delimited (`|`) text; columns like `Product Name`, `SKU`, `Buy URL`, `Image URL`, `Sale Price`, `Currency Code`.
- **Env:** `RAKUTEN_FEED_URL`

### Tradedoubler  — `--source tradedoubler`
- **Covers:** broad EU coverage (fashion + lifestyle).
- **Sign up:** <https://www.tradedoubler.com/> → Publisher. Free.
- **Approval:** apply per programme; manual review common.
- **Get the feed:** Publisher UI → **Product Feeds** (download) or the **Product Feed API** (token-based).
- **API key:** API token issued in the publisher account for the feed/voucher APIs.
- **Format:** CSV (`,`) by default (XML also available); columns like `name`, `sku`, `brand`, `category`, `productUrl`, `productImage`, `price`, `currency`, `availability`.
- **Env:** `TRADEDOUBLER_FEED_URL`

### US / Canada networks

For the US and Canadian market, the biggest catalogues come from CJ, Impact and
ShareASale. **Awin** (it absorbed ShareASale) and **Rakuten** above also have
strong US/CA advertiser rosters — the same adapters work, just different
merchants. US feeds frequently **omit a currency column**; these adapters default
to **USD**, and `CAD` is in the built-in FX table, so Canadian programmes
normalise to EUR correctly (override anything via `FX_RATES`).

#### CJ Affiliate (Commission Junction)  — `--source cj`
- **Covers:** #1 US network — huge fashion/lifestyle roster (Bonobos, J.Crew, Nordstrom, etc.), plus Canada.
- **Sign up:** <https://www.cj.com/> → Publisher. Free.
- **Approval:** apply per advertiser ("Join programme"); a live site/domain is usually required for approval.
- **Get the feed:** Publisher dashboard → **Product Feeds** (downloadable datafeed) or the **Product Search / GraphQL API** (needs a Personal Access Token under Account → Settings → API).
- **API key:** PAT only for the API; downloadable datafeeds don't need one.
- **Format:** delimited (`,`), classic CJ columns (`NAME`, `SKU`, `MANUFACTURER`, `SALEPRICE`, `CURRENCY`, `BUYURL`, `IMAGEURL`, `ADVERTISERCATEGORY`, `INSTOCK`, …).
- **Env:** `CJ_FEED_URL`

#### Impact (impact.com)  — `--source impact`
- **Covers:** large US network, especially direct-to-consumer brands (Allbirds, Mack Weldon, Frank And Oak/CA, …).
- **Sign up:** <https://impact.com/> → Partners. Free.
- **Approval:** apply per brand ("campaign"); review varies by advertiser.
- **Get the feed:** Partner dashboard → **Catalogs** (downloadable product catalog) or the Catalog API (token-based).
- **Format:** delimited (`,`), Google-Merchant-style columns (`Title`, `Brand`, `Sale Price`, `Currency`, `Link`, `Image Link`, `Google Product Category`, `Availability`, `Gender`, `Color`, …).
- **Env:** `IMPACT_FEED_URL`

#### ShareASale  — `--source shareasale`
- **Covers:** US-focused, lots of independent/heritage menswear (Huckberry/Flint and Tinder, Todd Snyder, Roots/CA, …). Now part of Awin.
- **Sign up:** <https://www.shareasale.com/> (or via Awin) → Affiliate. Free.
- **Approval:** apply per merchant; many auto-approve.
- **Get the feed:** Account → **Tools → Create a Datafeed / Product Discovery** for a personal download URL (your affiliate ID is embedded).
- **Format:** pipe-delimited (`|`), columns like `ProductID`, `Name`, `Merchant`, `Link`, `BigImage`, `Price`, `Category`, `Brand`, `InStock` (currency often absent → defaults to USD).
- **Env:** `SHAREASALE_FEED_URL`

### Scraper / custom JSON  — `--source scraper`
- **Purpose:** the **integration point for scrapers** or any brand without an
  affiliate feed. Your scraper just emits canonical JSON; no adapter code needed.
- **No keys / no approval.** (Mind each site's ToS and that direct links earn no commission.)
- **Format:** JSON array, or `{ "products": [...] }`. Each item uses canonical
  keys (`externalId`, `title`, `brand`, `category`, `color`, `price`,
  `currency`, `imageUrl`, `deeplink`, `gender`, `inStock`, optional `source`).
  See `data/feeds/samples/scraper.json`.
- **Env:** `SCRAPER_FEED_URL` (or just `--file path.json`).

---

## 4. Add a new feed in the future

1. Add an entry to `SOURCES` in `scripts/feeds/sources.mjs` with the feed
   `format`, parse options (delimiter / XML record path), and a `map` listing
   candidate column names per canonical field. Optionally set `defaultCurrency`
   (e.g. `"USD"`) for feeds that omit a currency column.
2. (Optional) add a sample to `data/feeds/samples/` and to `SAMPLES`.
3. Test: `node scripts/import-feed.mjs --source <key> --file <sample> --dry-run`.

No changes to parsing, validation, embeddings, or DB code are required.

---

## 5. Keep it fresh (production) — durable workflow + daily Vercel Cron

Refresh runs as a **durable workflow** (Vercel Workflow DevKit), so a transient
embedding/DB error retries just the affected chunk and the job survives crashes
and instance timeouts instead of restarting from scratch.

- **Trigger:** `GET /api/cron/refresh-catalog` (`src/app/api/cron/refresh-catalog/route.ts`).
  Collects every source whose `*_FEED_URL` env is set, then `start()`s the
  workflow and returns immediately with a `runId` (non-blocking — no 300s
  function cap on the import itself).
- **Workflow:** `refreshCatalogWorkflow` (`src/workflows/refresh-catalog.ts`):
  - `prepareSource` step — parse + map + validate one feed (retryable).
  - `ingestChunk` step — embed + upsert **50 products at a time**; each chunk
    retries independently. Upserts key on `(source, external_id)`, so re-runs
    update existing rows and add new ones.
- **Schedule:** `vercel.json` → daily at 03:00 UTC. Edit the cron expression there.
- **Security:** set `CRON_SECRET`. Vercel Cron automatically sends
  `Authorization: Bearer $CRON_SECRET`; both routes reject anything else (401).
- **Tuning:** `CATALOG_REFRESH_LIMIT` caps products per source per run.
- **Setup note:** the Workflow DevKit needs AI Gateway OIDC. `vercel link` +
  `vercel env pull` provides `VERCEL_OIDC_TOKEN`; on Vercel it works with no
  extra config (Fluid Compute recommended).

Manual trigger (e.g. to test in production):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/refresh-catalog
# → { "ok": true, "runId": "...", "sources": ["awin", ...] }
```

Check progress of a run:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-app.vercel.app/api/cron/refresh-catalog/status?runId=<runId>"
```

Inspect runs locally / on Vercel with the WDK tooling:

```bash
npx workflow web                 # visual dashboard
npx workflow inspect runs        # CLI list
npx workflow inspect run <runId> # single run detail
```

Local manual refresh stays available via the CLI (synchronous, no workflow):
`npm run import:feed -- --source awin --url "$AWIN_FEED_URL"`.
