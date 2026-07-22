# Customer Acquisition — growth plan (Valetti)

How to attract customers to Valetti (AI men's personal stylist, valetti.fit). This is a sequencing plan, not a channel dump: the order matters more than the list.

**Core principle.** Do NOT start with paid traffic. An early product almost always has a leaky funnel, and paid ads just burn budget while exposing that. Correct order:

> **Activation → free "taste" → organic video/content → referral loop → then paid, to scale only what already works.**

**Second principle — the product is the marketing.** Valetti already generates share-worthy artifacts: the magazine-style PDF cover, the "on you" try-on images, the colour palette, Carlo's expert opinion. The whole plan is built around pushing those artifacts outward, not inventing new creative from scratch.

---

## 1. Positioning & wedge

Men's styling is underserved: nearly all styling content targets women, and men want a **definitive answer** ("just tell me what to wear and buy"), not an endless scroll. A human stylist costs hundreds of euros and feels awkward. Valetti = "a personal expert stylist that privately, quickly and cheaply tells you what suits *you*."

- **Wedge #1 — colour analysis for men.** Colour analysis is peaking virally on TikTok/Instagram but is almost entirely in the female space. "Your colours from one selfie, for men" is a timely, specific, under-contested entry point. Make it the spearhead.
- **ICP & purchase triggers** — man 25–45, disposable income, at a transition: new job / promotion / moving into client-facing roles, dating & dating apps, divorce, weight change, turning 30/40, a wedding (his own or as a guest), relocation.
- **Secondary segment** — women buying a style report as a gift for their partner (drives gifting channel + seasonal spikes).

---

## 2. Fix the funnel before pouring in traffic

Today the first step is a paid report — a high barrier for cold traffic. Add a **free entry point**:

- **Free "Your colours" mini colour analysis** from one selfie → returns a colour palette + 2–3 lines from Carlo → paywall to the full report (wardrobe, shopping, try-on).
- Cheap on compute, maximally shareable, rides the viral trend, and captures an email for remarketing.
- Detailed build spec: see `docs/free-colour-analysis-plan.md`.

**Activation metric** — not "signup", but "first report generated + wow moment" (opened the PDF / saw the try-on). Optimize all acquisition toward that, not toward clicks.

**Instrument from day one** — the five funnel numbers: visitor → free analysis → signup → paid report → repeat purchase. Do not turn on paid traffic until these exist.

---

## 3. Channels, in priority order

### A. Short-form video (TikTok / Reels / YT Shorts) — channel #1
The product is visually transformational, and transformation shares itself. Formats:
- **Before/after** using the "on you" try-on.
- **"I let an AI stylist dress me for a week"** vlog.
- **Colour-analysis reveal + reaction** ("didn't believe it until I saw myself in my own colours").
- **"Reacting to your outfits"** — Carlo/founder comments on submitted photos (UGC engine).
- **Celebrity / meme breakdowns** ("dressing the average software developer").

Post 1–2 videos/day, founder-led. Free and compounding. One or two hits can outperform a month of ads.

### B. SEO / content — compounds for years
High-intent men's queries with little competition:
- "what colours suit me (man)", "men's colour season", "smart casual for [body type]", "how to dress if you're short/heavier (man)", "men's capsule wardrobe".
- Every article ends in a CTA to the free analysis. Some report sections double as SEO landing pages.

### C. Reddit / niche communities — carefully
r/malefashionadvice, r/femalefashionadvice (for gifting), grooming/"glow up" subs. These communities hate ads — enter through genuine value: free breakdowns, AMAs, not promos. One good breakdown thread beats ten promo posts.

### D. Creators / influencers — micro, pay-for-performance
Men's style creators, "glow up" creators, **dating coaches**, **barbers** (same "want to look better" audience). Give free credits + an affiliate link; pay on results, not on posts.

### E. Product Hunt — one-time burst
Tech-savvy early adopters. Prep in advance: try-on GIF, testimonials, launch offer. A strong day = hundreds of quality early adopters + SEO backlinks.

### F. Partnerships
- **Barbershops** (QR/flyer "get your free colour analysis").
- **Dating apps** — content collabs "level up your profile".
- **Wedding venues / suit rental** — groom & guest.
- **HR / corporate onboarding** — "dress for success" for new client-facing hires.

### G. Paid traffic — last, to scale
Meta + TikTok ads, but **only after** organic reveals which video creative converts. Retarget people who did the free analysis but didn't buy — the cheapest, most profitable segment. Launch when CAC < LTV is proven.

---

## 4. Growth loops (built into the product)

1. **Artifact sharing.** Put subtle Valetti branding + "make yours at valetti.fit" on the PDF cover, try-on images and palette; add a one-tap "share my palette/look" button. Users post results → friends see → come. (Infra already exists: `src/lib/og/report-share-card*`.)
2. **Referral.** "Refer a friend — you both get a credit." The credit model is perfect for this.
3. **Gifting.** Sell a "style report as a gift" (women/holidays segment). A gift card = a new occasion and a new channel.

---

## 5. Retention / LTV (makes acquisition cheaper)

Higher LTV and repeat purchases let you pay more per customer and strengthen word of mouth:
- **Seasonal reports** ("refresh your wardrobe for autumn").
- **Wardrobe-as-asset** (`docs/wardrobe-as-asset-plan.md`) — brings users back, raises frequency.
- **Occasion reports** — a dedicated report for a wedding / holiday / interview.
- **Email lifecycle** — abandoned free analysis → "your palette is ready, unlock your full look".

---

## 6. Metrics & early targets

| Stage | Metric | Early target |
|---|---|---|
| ToFu | visit → free analysis | ≥ 25–35% |
| Activation | free → signup | ≥ 40% |
| Monetization | signup → paid report | 5–12% |
| Repeat | buyers with ≥2 purchases (90d) | ≥ 20% |
| Virality | k-factor (referrals/user) | → 0.3+ |
| Unit economics | LTV / CAC | > 3 before scaling ads |

---

## 7. 90-day roadmap

**Days 1–30 — foundation & the "taste".**
- Ship the free mini colour analysis + paywall.
- Instrument end-to-end funnel (the five numbers above).
- Add branding + sharing to PDF/try-on/palette artifacts.
- Stand up TikTok/IG/YT, start posting (10–15 videos to calibrate).

**Days 31–60 — organic engine.**
- Daily video; double down on formats that get views.
- Publish 8–10 SEO articles around "men's colour season / body type".
- Launch referral + gift cards.
- Product Hunt launch.
- 3–5 micro-creators on performance terms.

**Days 61–90 — scale what's proven.**
- Take top-3 organic creatives → paid retargeting + lookalikes, small budget.
- First partnerships (barbers / dating / weddings).
- Optimize paywall + email lifecycle on data.
- Scale only channels with LTV/CAC > 3.

---

## 8. Budget (bootstrap mode)

- **Days 0–60:** ~€0 media. Main cost is founder time (video + content) + tooling. Pay creators in credits/performance.
- **Days 60–90:** small test budget (~€500–1500/mo) on ads, **only** to scale proven creative.
- Rule: no paid budget until CAC and LTV are known.

---

## 9. What NOT to do
- Don't run paid traffic before organic finds converting creative.
- Don't spam Reddit/communities — you'll get banned and burn reputation.
- Don't target "all men" broadly — hit the triggers (new job, dating, wedding).
- Don't hide all value behind the paywall with no free taste.
- Don't chase features over distribution — the bottleneck right now is acquisition, not the product.

---

## 10. Highest-leverage move

The free men's colour analysis as the spearhead + artifact sharing is the single highest-leverage element: it simultaneously fixes the funnel and feeds the #1 channel (video). Build it first — see `docs/free-colour-analysis-plan.md`.
