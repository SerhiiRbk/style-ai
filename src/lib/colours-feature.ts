/**
 * Master switch for the free colour-analysis initiative — `/colours` and
 * `POST /api/colours`.
 *
 * Both surfaces MUST read this one flag. Guarding only the page left
 * `POST /api/colours` publicly callable: an unauthenticated endpoint that
 * spends a paid vision call per request, protected solely by an in-memory rate
 * limiter that serverless instances do not share.
 *
 * Enabled in A2 now that A0 (durable rate limiter + global daily spend cap,
 * photo-hash cache, lead-magnet cap response) has shipped — see
 * `docs/superpowers/specs/2026-08-01-valetti-growth-design.md`, §4 A0/A2.
 *
 * `as boolean` keeps the paused-state code paths reachable for type-checking.
 */
export const COLOURS_ENABLED = true as boolean;

/**
 * Launch boundary: /colours is diagnosis only. Shop, looks and PDF stay
 * behind /start. Flip to re-enable the anonymous shop block.
 */
export const COLOURS_FREE_SHOWS_SHOP = false as boolean;
