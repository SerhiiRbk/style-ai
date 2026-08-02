/**
 * Master switch for the free colour-analysis initiative — `/colours` and
 * `POST /api/colours`.
 *
 * Both surfaces MUST read this one flag. Guarding only the page left
 * `POST /api/colours` publicly callable: an unauthenticated endpoint that
 * spends a paid vision call per request, protected solely by an in-memory rate
 * limiter that serverless instances do not share.
 *
 * Flip to `true` only once A0 (durable rate limiter + global daily spend cap)
 * has shipped — see `docs/superpowers/specs/2026-08-01-valetti-growth-design.md`,
 * §3 item 2а and §4 A0.
 *
 * `as boolean` keeps the guarded code paths reachable for type-checking.
 */
export const COLOURS_ENABLED = false as boolean;
