/**
 * Brand identity. The product is presented as the atelier "Valetti", with
 * Carlo Valetti as its lead stylist persona — a calm, European, quiet-luxury
 * voice. The service is AI-assisted; that is disclosed subtly (subtitle/footer)
 * rather than foregrounded.
 */
export const BRAND = {
  /** House name — used as the logo / wordmark everywhere. */
  name: "Valetti",
  /** Legal / footer name. */
  legalName: "Valetti",
  /** Small descriptor that sits under the wordmark. */
  eyebrow: "Personal style atelier",
  /** Honest, understated AI disclosure. */
  tagline: "AI-assisted personal styling",

  /** Open Graph / social share card (flat lay men's essentials). */
  ogImage: "/images/flatlay-essentials.png",
  ogImageWidth: 1536,
  ogImageHeight: 1024,
  /** Square share card (1080x1080) for Instagram / LinkedIn posts. */
  ogSquare: "/images/og-square.png",

  /** The expert persona who fronts the brand. */
  stylist: {
    name: "Carlo Valetti",
    first: "Carlo",
    role: "Lead stylist",
    /** Editorial seated portrait (hero / Meet-your-stylist section). */
    portrait: "/images/carlo-valetti.png",
    /** Square headshot crop (512×512) for avatars and signatures. */
    avatar: "/images/carlo-avatar.png",
    /** Environmental atelier shot (secondary editorial use). */
    atelier: "/images/carlo-atelier.png",
    /** One-line voice used in signatures. */
    signature: "Carlo Valetti · Lead stylist, Valetti",
  },
} as const;
