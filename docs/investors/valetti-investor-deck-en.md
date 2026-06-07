# Valetti — Investor overview (English)

**Confidential · 2026**

**Live version:** https://valetti.fit/investors  
**Contact:** founder@valetti.fit  
**Site:** valetti.fit

---

## Summary

Valetti is an AI-native personal styling platform for EU and USA markets. Users upload photos; our **Style Recommendation Engine (SRE)** builds a Style Profile, generates photorealistic looks, matches real catalog products, and supports virtual try-on.

- **Paid reports:** €10 (Basic) · €20 (Lookbook) · €35 (Premium)
- **Catalog:** 5,000+ SKUs
- **Markets:** EU / USA · GDPR + CCPA-ready
- **Model:** Pay-as-you-go credits (no subscription)

---

## 01 · Approach

### Problem

78% of men and women aged 30–55 in the EU and USA spend hours shopping without confidence. Human stylists cost $150–400 / €150–400 per session. ChatGPT gives text — not photos, catalog, or try-on.

### Solution

One engine: appearance + season + climate → personal looks → real products → photorealistic preview + virtual try-on. Every recommendation is explainable.

**Differentiator:** Closed pipeline (analysis → look → purchase → try-on) with Style Profile as source of truth — not a generic LLM chat.

---

## 02 · Product

**valetti.fit** — brand face · inspired by Carlo Valetti

| Stage | Description |
|-------|-------------|
| Acquisition | 6 free credits on signup, Starter Report, EUR + USD |
| Core flow | Intake → photos → SRE pipeline → report + Shop the Look |
| Monetization | Credits, packs, affiliate deeplinks, PDF |

---

## 03 · Pricing

1 credit ≈ €1. Credits never expire. New accounts: 6 free credits.

| Tier | Price | Credits | Includes |
|------|-------|---------|----------|
| Starter | €0 | 5 | 1 look · colour & hair · try-on |
| Basic | €10 | 10 | 3 looks · shopping list · PDF |
| Lookbook | €20 | 20 | 4 looks · capsule · week matrix |
| Premium | €35 | 35 | 6 looks · grooming · accessories |

**Credit packages:** Single €10 · Plus €20 · Pro €35 · Max €79

**Roadmap:** Membership €14.99/mo · Business white-label from €99/mo

---

## 04 · Monetization

Target revenue mix (Year 2, illustrative):

- Credit packs — 42%
- Report tiers — 35%
- Affiliate (catalog) — 15%
- B2B white-label — 8%

Affiliate: deeplinks on shopping list and Shop the Look — no inventory held.

---

## 05 · Unit economics

| Tier | Price | COGS | Stripe ~ | Contribution | Margin |
|------|-------|------|----------|--------------|--------|
| Starter | €0 | €0.23 | — | loss-leader | funnel |
| Basic | €10 | €0.34 | €0.59 | €9.07 | ~91% |
| Lookbook | €20 | €0.64 | €0.88 | €18.48 | ~92% |
| Premium | €35 | €1.08 | €1.32 | €32.60 | ~93% |

Image generation ≈ 72% of variable COGS. Paid reports: **~90–93% contribution margin** after Stripe.

---

## 06 · Competition

● full · ◐ partial · ○ none

| Player | Price | Colour | Shape | Looks | Catalog | VTON | Why | Pay-go | EU/USA |
|--------|-------|--------|-------|-------|---------|------|-----|--------|--------|
| **Valetti** | €10–35 | ● | ● | ● | ● | ● | ● | ● | ● |
| Stitch Fix | €20+ | ◐ | ○ | ○ | ● | ○ | ◐ | ○ | ◐ |
| Lookiero | €10–12/mo | ◐ | ○ | ○ | ● | ○ | ◐ | ○ | ● |
| ChatGPT | €20/mo | ◐ | ◐ | ○ | ○ | ○ | ◐ | ○ | ◐ |
| Zalando AI | Free | ○ | ○ | ○ | ● | ◐ | ○ | ● | ● |

**White space:** Full loop at pay-as-you-go €10–35 — no competitor matches end-to-end.

---

## 07 · Technology — SRE

**Engines:**

- **CAE** — Color Analytic Engine (season, palette, undertone)
- **SAE** — Shape Analytics Engine (face, body, silhouette)
- **FE** — Fashion Engine (climate, season, RAG rules)
- **CHE** — Catalog Host Engine (feeds, scrapers, pgvector)

**Flow:** Photos → Profile → RAG + SRE → looks → catalog match → try-on → PDF

---

## 08 · Infrastructure

| Layer | Stack |
|-------|-------|
| Experience | valetti.fit — Next.js on Vercel |
| Orchestration | Vision → profile → recommend → match → render |
| AI Gateway | Vercel AI SDK |
| Data | Supabase Postgres + pgvector (EU region) |
| Commerce | Credits + Stripe + affiliate |

---

## 09 · Moat & roadmap

**Moat:**

- Proprietary multi-engine SRE
- Real catalog + embeddings
- Explainable recommendations
- VTON in one product
- Credit gating on GPU steps

**Roadmap:**

1. Scale catalog (EU + USA)
2. Stripe checkout + membership
3. B2B pilots
4. Mobile + stylist marketplace

---

*Valetti · Personal style atelier · Confidential · Brand face · inspired by Carlo Valetti*
