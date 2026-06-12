# Referral program — economics & rules (Valetti)

Draft for a friend-invite program: referrer earns credits when an invited user registers and makes a paid purchase; the friend gets an extra signup bonus. **Contribution margin on the friend's first purchase must stay ≥ 70%** in every scenario.

---

## Base assumptions (current Valetti unit economics)

| Parameter | Value |
|---|---|
| 1 credit (nominal) | ≈ €1 |
| COGS try-on / regen | ≈ €0.04 / credit |
| COGS Basic report (10 cr) | ≈ €0.34 |
| COGS Premium (35 cr) | ≈ €1.08 |
| Stripe | 2.9% + €0.30 |
| Current signup bonus | 6 credits (Starter + try-on; COGS ≈ €0.23 on Starter path) |

**Cost of a “free” credit** is not COGS alone (€0.04) but **forgone contribution margin** ≈ **€0.85–0.92** per credit if the user actually spends it (as if bought in a pack).

Referral calculations use **€0.85 / credit** (conservative).

---

## 70% margin rule on the friend's transaction

On the friend's **first purchase**, revenue = `R`:

```
Max referral budget = 30% × R − Stripe − COGS buffer
                    ≈ 0.28 × R − €0.30
```

| Friend purchase (R) | Stripe | Bonus budget (≈28% − fixed) | Max credits (÷ €0.85) |
|---|---|---|---|
| €10 (Single) | €0.59 | **€2.50** | **~3 cr** |
| €20 (Plus) | €0.88 | **€5.30** | **~6 cr** |
| €35 (Pro) | €1.32 | **€9.50** | **~11 cr** |
| €79 (Max) | €2.59 | **€21.80** | **~25 cr** |

**Conclusion:** **10 referrer credits** only fit if the friend buys **≈ €35+**, not €10.

The friend's **signup bonus** (+2…3 cr) should be booked as **separate CAC** (pre-purchase), not mixed into the purchase-event budget — otherwise a €10 purchase breaks margin even faster.

---

## Recommended model: two axes

### Axis 1 — referrer lifetime spend (program access)

| Referrer lifetime spend | Can invite? | Max rewards / year | Max credits / year |
|---|---|---|---|
| €0 (free only) | No | 0 | 0 |
| €10–19 | Yes (basic) | 6 | 18 |
| €20–34 | Yes | 12 | 60 |
| €35–78 | Yes | 24 | 120 |
| €79+ | Yes (VIP) | 36 | 360 |

**Entry threshold:** at least **€10 real purchase** (not Starter on signup credits alone). Only paying users get a referral link.

### Axis 2 — friend's purchase → referrer reward

| Friend's first purchase | Referrer bonus | Deal margin* |
|---|---|---|
| €10–14 | **+2 credits** | ~74% |
| €15–19 | **+3 credits** | ~72% |
| €20–34 | **+5 credits** | ~71% |
| €35–78 | **+8 credits** | ~71% |
| €79+ | **+10 credits** | ~72% |

\*After Stripe and cost of granted credits (€0.85/cr). COGS when credits are **used** adds ~3–5% extra headroom.

**10 referrer credits** — only when friend purchase **≥ €35** and referrer has spent **≥ €35**.

---

## Friend signup bonus (on top of default 6 credits)

| Referrer tier | Extra signup | Total signup |
|---|---|---|
| €10–19 | +2 | **8 credits** |
| €20+ | +3 | **9 credits** |

Do not give +10 to the friend: that is nearly a second Starter Report for free → COGS + fraud without revenue.

Extra signup COGS ≈ €0.08–0.15 if spent on try-on — acceptable CAC if the friend later purchases.

---

## Scenario check: “10 credits per friend”

| Scenario | ≥ 70% margin? |
|---|---|
| Friend €10, friend +3 signup, referrer +10 | No (~−20% margin) |
| Friend €35, friend +3 signup, referrer +10 | Yes (~71%) |
| Friend €20, referrer +10 | No |
| Friend €20, referrer +5 | Yes |

---

## Anti-abuse (required)

1. Referral cookie / `?ref=` — only **before registration**; one referrer per account.
2. Referrer reward only on friend's **first Stripe purchase** (not promo, not admin grant).
3. Minimum friend purchase **€10**.
4. Block self-referral (email + Stripe customer fingerprint).
5. Yearly caps from referrer tier table.
6. Idempotent referrer grant: `ref_ext: referral:{friend_user_id}` (same pattern as Stripe webhook).

---

## User-facing copy (marketing)

> Invite a friend — they get **+3 credits** when they sign up.  
> When they buy credits for the first time, you earn **up to 10 credits** — the larger their pack, the larger your bonus.  
> The more you've spent on Valetti, the more friends you can invite.

Do not promise “10 credits for any friend who spends €10”.

---

## Summary recommendation

| Role | Bonus |
|---|---|
| **Friend** | +2…3 credits on signup (by referrer tier) |
| **Referrer** | 2–10 credits on friend's **first purchase** (scaled by €) |
| **Referral link access** | Referrer lifetime spend ≥ **€10** |
| **10 referrer credits** | Friend purchase ≥ **€35** and referrer spend ≥ **€35** |

This keeps the program attractive (up to 10 cr for a strong referral), rewards the friend (+3 cr), and keeps **margin ≥ 70%** for every combination in the tables above.

---

## Next implementation steps (when ready)

1. Add `REFERRAL_TIERS` constants mirroring the tables above.
2. DB: `referrals` (referrer_id, referred_user_id, attributed_at) + idempotent grants in Stripe webhook.
3. UI: “Invite friends” on `/reports` with copy link + stats (invited / paid / credits earned).
4. Terms & Privacy: referral rules, fraud, credit grants as marketing incentives.

---

*Credit packages (EUR): Single €10 (11 cr) · Plus €20 (22 cr) · Pro €35 (40 cr) · Max €79 (100 cr).*

*Last updated: June 2026.*
