"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { creditReasonLabel } from "@/lib/credit-reason-labels";
import { reportStatusLabel, tierLabel } from "@/lib/report-labels";
import type { Tier } from "@/lib/report";

type AdminUserSummary = {
  id: string;
  email: string | null;
  country: string | null;
  locale: string | null;
  createdAt: string;
  creditBalance: number;
  reportsCount: number;
  purchasesCount: number;
  creditsPurchased: number;
  promosCount: number;
  tryonsCount: number;
  photosCount: number;
  creditsSpent: number;
  creditsEarned: number;
  activityByReason: Record<string, number>;
};

type AdminUserDetail = AdminUserSummary & {
  reports: {
    id: string;
    createdAt: string;
    headline: string | null;
    tier: Tier;
    status: "processing" | "ready" | "failed";
  }[];
  purchases: { createdAt: string; credits: number; refExt: string | null }[];
  promos: { code: string; name: string; credits: number; redeemedAt: string }[];
  ledger: {
    createdAt: string;
    delta: number;
    reason: string;
    refId: string | null;
    refExt: string | null;
    balanceAfter: number | null;
  }[];
  tryonsReady: number;
  tryonsFailed: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border hairline bg-paper px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-stone-soft">
        {label}
      </div>
      <div className="mt-1 font-display text-xl text-ink">{value}</div>
    </div>
  );
}

function UserDetailPanel({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(`/api/admin/users/${userId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not load user");
        if (!cancelled) setUser(data.user ?? null);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load user");
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="mt-6 rounded-2xl border hairline bg-cream/30 p-8 text-sm text-stone">
        Loading user activity…
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error ?? "User not found"}
        <button
          type="button"
          onClick={onClose}
          className="ml-4 text-red-900 underline"
        >
          Close
        </button>
      </div>
    );
  }

  const activityEntries = Object.entries(user.activityByReason).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="mt-6 rounded-2xl border hairline bg-cream/20 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl">
            {user.email ?? "No email"}
          </h3>
          <p className="mt-1 text-sm text-stone">
            Joined {formatDate(user.createdAt)}
            {user.country ? ` · ${user.country}` : ""}
            {user.locale ? ` · ${user.locale}` : ""}
          </p>
          <p className="mt-1 font-mono text-xs text-stone-soft">{user.id}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border hairline px-4 py-2 text-sm text-stone transition-colors hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Credit balance" value={user.creditBalance} />
        <StatCard label="Reports" value={user.reportsCount} />
        <StatCard label="Purchases" value={user.purchasesCount} />
        <StatCard label="Credits bought" value={user.creditsPurchased} />
        <StatCard label="Credits spent" value={user.creditsSpent} />
        <StatCard label="Credits earned" value={user.creditsEarned} />
        <StatCard label="Try-ons" value={user.tryonsCount} />
        <StatCard label="Photos uploaded" value={user.photosCount} />
        <StatCard label="Promos used" value={user.promosCount} />
        <StatCard
          label="Try-ons ready / failed"
          value={`${user.tryonsReady} / ${user.tryonsFailed}`}
        />
      </div>

      {activityEntries.length > 0 && (
        <div className="mt-10">
          <h4 className="text-sm uppercase tracking-wider text-stone-soft">
            Paid actions (ledger)
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {activityEntries.map(([reason, count]) => (
              <span
                key={reason}
                className="rounded-full border hairline bg-paper px-3 py-1 text-xs text-stone"
              >
                {creditReasonLabel(reason)}:{" "}
                <span className="font-medium text-ink">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h4 className="font-display text-lg">Reports</h4>
          {!user.reports.length ? (
            <p className="mt-2 text-sm text-stone">No reports yet.</p>
          ) : (
            <ul className="mt-3 divide-y hairline rounded-xl border hairline bg-paper">
              {user.reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/report/${r.id}`}
                      className="block truncate font-medium text-ink hover:text-brass"
                    >
                      {r.headline || "Style report"}
                    </Link>
                    <p className="text-xs text-stone">
                      {formatDate(r.createdAt)} · {tierLabel(r.tier)} ·{" "}
                      {reportStatusLabel(r.status)}
                    </p>
                  </div>
                  <Link
                    href={`/report/${r.id}`}
                    className="shrink-0 text-xs text-brass hover:text-ink"
                  >
                    Open →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="font-display text-lg">Credit purchases</h4>
          {!user.purchases.length ? (
            <p className="mt-2 text-sm text-stone">No Stripe purchases yet.</p>
          ) : (
            <ul className="mt-3 divide-y hairline rounded-xl border hairline bg-paper">
              {user.purchases.map((p) => (
                <li
                  key={`${p.createdAt}-${p.refExt}`}
                  className="px-4 py-3 text-sm"
                >
                  <div className="flex justify-between gap-4">
                    <span className="text-stone">{formatDate(p.createdAt)}</span>
                    <span className="font-medium text-ink">+{p.credits} cr</span>
                  </div>
                  {p.refExt && (
                    <p className="mt-1 truncate font-mono text-xs text-stone-soft">
                      {p.refExt}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h4 className="font-display text-lg">Promo redemptions</h4>
        {!user.promos.length ? (
          <p className="mt-2 text-sm text-stone">No promos redeemed.</p>
        ) : (
          <ul className="mt-3 divide-y hairline rounded-xl border hairline bg-paper">
            {user.promos.map((p) => (
              <li
                key={`${p.code}-${p.redeemedAt}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-medium text-ink">{p.code}</span>
                  <span className="text-stone"> · {p.name}</span>
                </div>
                <div className="text-stone">
                  +{p.credits} cr · {formatDate(p.redeemedAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h4 className="font-display text-lg">Credit ledger (latest 200)</h4>
        {!user.ledger.length ? (
          <p className="mt-2 text-sm text-stone">No ledger entries.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border hairline bg-paper">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b hairline text-xs uppercase tracking-wider text-stone-soft">
                  <th className="px-4 py-3 font-normal">When</th>
                  <th className="px-4 py-3 font-normal">Reason</th>
                  <th className="px-4 py-3 font-normal text-right">Delta</th>
                  <th className="px-4 py-3 font-normal text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y hairline">
                {user.ledger.map((row, i) => (
                  <tr key={`${row.createdAt}-${i}`}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-stone">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-ink">
                      {creditReasonLabel(row.reason)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${
                        row.delta > 0 ? "text-brass" : "text-ink"
                      }`}
                    >
                      {row.delta > 0 ? `+${row.delta}` : row.delta}
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone">
                      {row.balanceAfter ?? "—"}
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

export function UsersAdminPanel() {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load users");
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(query.trim());
    setPage(1);
    setSelectedId(null);
  }

  return (
    <div>
      <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-soft">
            Search by email
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="user@example.com"
            className="w-full rounded-xl border hairline bg-paper px-4 py-2.5 text-sm outline-none focus:border-brass/50"
          />
        </label>
        <button
          type="submit"
          className="rounded-full border border-brass/40 bg-brass/5 px-5 py-2.5 text-sm text-ink transition-colors hover:border-brass/60 hover:bg-brass/10"
        >
          Search
        </button>
      </form>

      <p className="mt-4 text-sm text-stone">
        {loading ? "Loading…" : `${total} user${total === 1 ? "" : "s"} total`}
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {!loading && !error && !users.length ? (
        <p className="mt-8 text-stone">No users match your search.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border hairline bg-paper">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b hairline text-xs uppercase tracking-wider text-stone-soft">
                <th className="px-4 py-3 font-normal">User</th>
                <th className="px-4 py-3 font-normal text-right">Balance</th>
                <th className="px-4 py-3 font-normal text-right">Reports</th>
                <th className="px-4 py-3 font-normal text-right">Purchases</th>
                <th className="px-4 py-3 font-normal text-right">Spent</th>
                <th className="px-4 py-3 font-normal text-right">Try-ons</th>
                <th className="px-4 py-3 font-normal text-right">Promos</th>
                <th className="px-4 py-3 font-normal" />
              </tr>
            </thead>
            <tbody className="divide-y hairline">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={
                    selectedId === u.id ? "bg-cream/50" : "hover:bg-cream/30"
                  }
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">
                      {u.email ?? "(no email)"}
                    </div>
                    <div className="text-xs text-stone">
                      {formatDate(u.createdAt)}
                      {u.country ? ` · ${u.country}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{u.creditBalance}</td>
                  <td className="px-4 py-3 text-right text-stone">{u.reportsCount}</td>
                  <td className="px-4 py-3 text-right text-stone">
                    {u.purchasesCount}
                    {u.creditsPurchased > 0 && (
                      <span className="block text-xs text-stone-soft">
                        +{u.creditsPurchased} cr
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-stone">{u.creditsSpent}</td>
                  <td className="px-4 py-3 text-right text-stone">{u.tryonsCount}</td>
                  <td className="px-4 py-3 text-right text-stone">{u.promosCount}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedId(selectedId === u.id ? null : u.id)
                      }
                      className="rounded-full border border-brass/40 bg-brass/5 px-3 py-1 text-xs text-ink transition-colors hover:border-brass/60"
                    >
                      {selectedId === u.id ? "Hide" : "Details"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-4 text-sm">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              setSelectedId(null);
            }}
            className="rounded-full border hairline px-4 py-2 text-stone transition-colors hover:text-ink disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-stone">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => {
              setPage((p) => p + 1);
              setSelectedId(null);
            }}
            className="rounded-full border hairline px-4 py-2 text-stone transition-colors hover:text-ink disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {selectedId && (
        <UserDetailPanel
          userId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
