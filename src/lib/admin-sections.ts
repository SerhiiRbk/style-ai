/** Admin console sections — keep in sync with gated routes under /admin and /investors. */
export const ADMIN_SECTIONS = [
  {
    href: "/admin/catalog",
    title: "Catalogue",
    description: "Browse products, edit listings, and trigger feed refreshes.",
  },
  {
    href: "/admin/promos",
    title: "Promotions",
    description: "Create promo codes, credit grants, and invite links.",
  },
  {
    href: "/investors",
    title: "Investor deck",
    description: "Confidential overview, unit economics, and deck download.",
  },
] as const;
