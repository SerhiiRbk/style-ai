import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { BRAND } from "@/lib/brand";
import { PromoAdminPanel } from "@/components/PromoAdminPanel";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-cream/20">
      <header className="flex items-center justify-between border-b hairline px-6 py-4">
        <Link href="/" className="font-display text-lg">
          {BRAND.name}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-stone-soft">
          <Link href="/admin/catalog" className="hover:text-ink">
            Catalogue
          </Link>
          <span>Admin · Promotions</span>
        </nav>
      </header>
      <div className="container-luxe py-12">{children}</div>
    </main>
  );
}

export default async function AdminPromosPage() {
  if (!hasSupabase) {
    return (
      <Shell>
        <p className="text-stone">
          Promotion tools require live mode (Supabase not configured).
        </p>
      </Shell>
    );
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  if (!isAdminEmail(user.email)) {
    return (
      <Shell>
        <h1 className="font-display text-2xl">Not authorised</h1>
        <p className="mt-2 text-stone">
          Add your email to <code>ADMIN_EMAILS</code> to manage promotions.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-display text-3xl">Promotions</h1>
      <p className="mt-2 max-w-2xl text-stone">
        Create promo codes and invite links. Credits are granted once per user
        when they sign in via the invite link or enter the code while logged in.
      </p>
      <div className="mt-10">
        <PromoAdminPanel />
      </div>
    </Shell>
  );
}
