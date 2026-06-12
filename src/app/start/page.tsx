import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { StartForm } from "./StartForm";

export default async function StartPage() {
  let userId: string | null = null;

  if (hasSupabase) {
    const sb = await createServerSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) redirect("/login");
    userId = user.id;
  }

  return <StartForm userId={userId} />;
}
