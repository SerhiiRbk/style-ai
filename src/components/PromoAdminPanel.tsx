"use client";

import { useCallback, useEffect, useState } from "react";

type Promotion = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  credits: number;
  max_activations: number;
  activations_count: number;
  expires_at: string;
  active: boolean;
  created_at: string;
  inviteUrl: string | null;
  remaining: number;
  expired: boolean;
};

export function PromoAdminPanel() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Promotion | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [credits, setCredits] = useState("10");
  const [maxActivations, setMaxActivations] = useState("50");
  const [validDays, setValidDays] = useState("30");
  const [customCode, setCustomCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/promotions");
      const data = (await res.json()) as {
        promotions?: Promotion[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setPromotions(data.promotions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          credits: Number(credits),
          maxActivations: Number(maxActivations),
          validDays: Number(validDays),
          code: customCode.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        promotion?: Promotion;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      setCreated(data.promotion ?? null);
      setName("");
      setDescription("");
      setCustomCode("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-12">
      <section className="rounded-2xl border hairline bg-paper p-8">
        <h2 className="font-display text-xl">Create promotion</h2>
        <p className="mt-2 text-sm text-stone">
          Generates a promo code and invite link. New users open the link before
          signing up; existing users enter the code on the pricing page.
        </p>
        <form onSubmit={create} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Name *" className="sm:col-span-2">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spring launch"
              className={inputCls}
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional internal note"
              className={inputCls}
            />
          </Field>
          <Field label="Promo credits *">
            <input
              required
              type="number"
              min={1}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Max activations *">
            <input
              required
              type="number"
              min={1}
              value={maxActivations}
              onChange={(e) => setMaxActivations(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Valid for (days) *">
            <input
              required
              type="number"
              min={1}
              value={validDays}
              onChange={(e) => setValidDays(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Custom code (optional)">
            <input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder="Auto-generated if empty"
              className={inputCls}
            />
          </Field>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-full bg-ink px-6 py-3 text-sm text-paper disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create promotion"}
            </button>
          </div>
        </form>

        {created ? (
          <div className="mt-6 rounded-xl border border-brass/40 bg-brass/5 p-4 text-sm">
            <p className="font-medium text-ink">Created: {created.name}</p>
            <p className="mt-2">
              Code:{" "}
              <code className="rounded bg-cream px-2 py-0.5">{created.code}</code>{" "}
              <button
                type="button"
                onClick={() => copy(created.code)}
                className="text-xs uppercase tracking-wider text-stone-soft hover:text-ink"
              >
                Copy
              </button>
            </p>
            {created.inviteUrl ? (
              <p className="mt-2 break-all">
                Invite:{" "}
                <a href={created.inviteUrl} className="text-ink underline">
                  {created.inviteUrl}
                </a>{" "}
                <button
                  type="button"
                  onClick={() => copy(created.inviteUrl!)}
                  className="text-xs uppercase tracking-wider text-stone-soft hover:text-ink"
                >
                  Copy
                </button>
              </p>
            ) : (
              <p className="mt-2 text-stone-soft">
                Set <code>NEXT_PUBLIC_SITE_URL</code> to generate invite links.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="font-display text-xl">All promotions</h2>
        {error ? <p className="mt-4 text-sm text-[#9E5C3C]">{error}</p> : null}
        {loading ? (
          <p className="mt-4 text-sm text-stone-soft">Loading…</p>
        ) : promotions.length === 0 ? (
          <p className="mt-4 text-sm text-stone-soft">No promotions yet.</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border hairline bg-paper">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b hairline text-xs uppercase tracking-wider text-stone-soft">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Credits</th>
                  <th className="px-4 py-3">Used</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Link</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.id} className="border-b hairline last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      {p.description ? (
                        <div className="text-xs text-stone-soft">{p.description}</div>
                      ) : null}
                      {p.expired ? (
                        <span className="text-xs text-[#9E5C3C]">Expired</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <code>{p.code}</code>
                    </td>
                    <td className="px-4 py-3">{p.credits}</td>
                    <td className="px-4 py-3">
                      {p.activations_count} / {p.max_activations}
                      <span className="text-stone-soft"> ({p.remaining} left)</span>
                    </td>
                    <td className="px-4 py-3 text-stone-soft">
                      {new Date(p.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {p.inviteUrl ? (
                        <button
                          type="button"
                          onClick={() => copy(p.inviteUrl!)}
                          className="text-xs uppercase tracking-wider text-stone-soft hover:text-ink"
                        >
                          Copy link
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border hairline bg-paper px-3 py-2 text-sm outline-none focus:border-ink/30";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-xs uppercase tracking-wider text-stone-soft">
        {label}
      </span>
      {children}
    </label>
  );
}
