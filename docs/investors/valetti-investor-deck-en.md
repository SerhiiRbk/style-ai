# Valetti — Investor overview (English)

**Confidential · 2026**

**Live version:** https://valetti.fit/investors  
**Contact:** founder@valetti.fit  
**Site:** valetti.fit

---

## Summary

Valetti is an AI-native personal styling platform for EU and USA markets. Users upload photos; our **Style Recommendation Engine (SRE)** builds a Style Profile, generates photorealistic looks, matches real catalog products, and supports virtual try-on. **Shop a Look** turns any inspiration photo into buyable pieces; the **Looks** gallery stores try-ons with Carlo's verdict.

- **Paid reports:** €10 (Basic) · €20 (Lookbook) · €35 (Premium)
- **Catalog:** 10,000+ SKUs
- **Markets:** EU / USA · GDPR + CCPA-ready
- **Model:** Pay-as-you-go credits (card + crypto) — no subscription required

---

## 01 · Approach

### Problem

Most men aged 30–55 in EU & USA shop without a clear personal system. Stylists cost $150–400/session. Generic AI chat gives text — not photos on you, catalog, or try-on.

### Solution

One engine: appearance + season + climate → personal looks → real products → photorealistic preview + virtual try-on. Shop a Look from any inspiration photo. Every recommendation is explainable.

**Differentiator:** Closed pipeline (analysis → look → purchase → try-on) with Style Profile as source of truth — plus Shop a Look and Looks gallery.

**Loop:** Photos → Profile → Looks → Catalog → Try-on → Decide

---

## 02 · Product

**valetti.fit** — brand face · inspired by Carlo Valetti

| Surface | Description |
|-------|-------------|
| Style reports | Starter → Premium: colour, hair, looks, capsule, shopping, PDF |
| Catalogue try-on | Up to 4 pieces on your photo · 1 credit |
| Shop a Look | Inspiration photo → garment slots → buyable matches → try-on |
| Looks gallery | History of renders + Carlo's verdict |

| Stage | Description |
|-------|-------------|
| Acquisition | 6 free credits on signup, Starter Report, EUR + USD |
| Core flow | Intake → photos → SRE pipeline → report + Shop the Look / Shop a Look |
| Monetization | Credits, packs (Lemon Squeezy / Stripe + NOWPayments crypto), affiliate, PDF |

---

## 03 · Pricing

1 credit ≈ €1. Credits never expire. New accounts: 6 free credits. Checkout: card + crypto.

| Tier | Price | Credits | Includes |
|------|-------|---------|----------|
| Starter | €0 | 5 | 1 look · colour & hair · try-on |
| Basic | €10 | 10 | 3 looks · shopping list · PDF |
| Lookbook | €20 | 20 | 6 looks · capsule · week matrix |
| Premium | €35 | 35 | 9 looks · grooming · accessories |

**Credit packages:** Single €10 · Plus €20 · Pro €35 · Max €79

**Roadmap:** Membership from €19.99/mo · Business white-label from €99/mo

---

## 04 · Monetization

Target revenue mix (Year 2, illustrative):

- Credit packs — 42%
- Report tiers — 35%
- Affiliate (catalog) — 15%
- B2B white-label — 8%

Affiliate: deeplinks on shopping list, Shop the Look, and Shop a Look — no inventory held.

---

## 05 · Unit economics

| Tier | Price | COGS | Fees ~ | Contribution | Margin |
|------|-------|------|--------|--------------|--------|
| Starter | €0 | €0.23 | — | loss-leader | funnel |
| Basic | €10 | €0.34 | €0.59 | €9.07 | ~91% |
| Lookbook | €20 | €0.64 | €0.88 | €18.48 | ~92% |
| Premium | €35 | €1.08 | €1.32 | €32.60 | ~93% |

Image generation ≈ 72% of variable COGS. Paid reports: **~90–93% contribution margin** after card fees. Crypto rail (NOWPayments) lowers fees further and removes chargebacks.

---

## 06 · Competition

full / partial / none (see live page for symbols)

| Player | Price | Colour | Shape | Looks | Catalog | VTON | Why | Pay-go | EU/USA |
|--------|-------|--------|-------|-------|---------|------|-----|--------|--------|
| **Valetti** | €10–35 | full | full | full | full | full | full | full | full |
| Stitch Fix | €20+ | partial | none | none | full | none | partial | none | partial |
| Lookiero | €10–12/mo | partial | none | none | full | none | partial | none | full |
| ChatGPT | €20/mo | partial | partial | none | none | none | partial | none | partial |
| Zalando AI | Free | none | none | none | full | partial | none | full | full |

**White space:** Full loop at pay-as-you-go €10–35 — no competitor matches end-to-end, including Shop a Look.

---

## 07 · Technology — SRE

**Engines:**

- **CAE** — Color Analytic Engine (season, palette, undertone)
- **SAE** — Shape Analytics Engine (face, body, silhouette)
- **FE** — Fashion Engine (climate, season, RAG rules)
- **CHE** — Catalog Host Engine (feeds, scrapers, pgvector)

**Flow:** Photos → Profile → RAG + SRE → looks → catalog match → try-on / Shop a Look → PDF

---

## 08 · Infrastructure

| Layer | Stack |
|-------|-------|
| Experience | valetti.fit — Next.js on Vercel |
| Orchestration | Vision → profile → recommend → match → render |
| AI Gateway | Gemini / Claude via AI Gateway |
| Data | Supabase Postgres + pgvector (EU region) |
| Commerce | Credits · Lemon Squeezy / Stripe · NOWPayments · affiliate |

---

## 09 · Moat & roadmap

**Moat:**

- Proprietary multi-engine SRE
- Real catalog + embeddings (10k+ SKUs)
- Explainable recommendations (Carlo)
- VTON in one product
- Shop a Look from inspiration photos
- Credit gating on GPU steps; card + crypto rails

**Roadmap:**

1. Scale catalog (EU + USA)
2. Membership tier + stylist tools
3. B2B pilots (white-label)
4. Mobile + stylist marketplace

---

*Valetti · Personal style atelier · Confidential · Brand face · inspired by Carlo Valetti*
