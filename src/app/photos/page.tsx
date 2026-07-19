import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Photo management now lives in the consolidated account hub. This route is kept
 * as a redirect so existing links/bookmarks still resolve.
 */
export default async function PhotosPage() {
  redirect("/account#photos");
}
