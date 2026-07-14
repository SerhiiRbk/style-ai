"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LIVE = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

type ModelPhoto = {
  storagePath: string;
  url: string;
  isDefault: boolean;
  createdAt: string;
};

/**
 * Lets the user choose which full-length photo catalogue try-on renders on.
 * The pinned default is resolved server-side by /api/tryon, so selecting one
 * here is all that's needed — no photo is passed from the client.
 */
export function TryOnModelPicker() {
  const [photos, setPhotos] = useState<ModelPhoto[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/photos");
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.photos)) setPhotos(data.photos as ModelPhoto[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!LIVE) return;
    void (async () => {
      try {
        const res = await fetch("/api/photos");
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.photos)) setPhotos(data.photos as ModelPhoto[]);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const current =
    photos?.find((p) => p.isDefault) ?? photos?.[0] ?? null;
  const hasDefault = Boolean(photos?.some((p) => p.isDefault));

  async function setDefault(storagePath: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/photos/default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not set default");
      }
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not set default");
    } finally {
      setBusy(false);
    }
  }

  async function remove(storagePath: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not delete photo");
      }
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not delete photo");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setMsg(null);
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("Sign in to upload a photo");

      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = `${user.id}/tryon/${crypto.randomUUID()}/full.${ext}`;
      const { error: upErr } = await sb.storage
        .from("photos")
        .upload(storagePath, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "full", storagePath, makeDefault: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not save photo");
      }
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!LIVE) return null;

  return (
    <div className="mb-6 rounded-2xl border hairline bg-paper px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg border hairline bg-cream/40">
            {current ? (
              <Image
                src={current.url}
                alt="Try-on model"
                fill
                sizes="40px"
                className="object-contain"
                unoptimized
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-stone-soft">
              Try-on model
            </p>
            <p className="truncate text-sm text-ink">
              {current
                ? hasDefault
                  ? "Your default photo"
                  : "Latest full-length photo"
                : "No full-length photo yet"}
            </p>
            {current && !hasDefault ? (
              <p className="text-[11px] text-stone-soft">
                Pick a default so every try-on uses the same photo.
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full border border-brass/40 bg-brass/5 px-4 py-1.5 text-sm text-ink transition-colors hover:border-brass/60 hover:bg-brass/10"
        >
          {current ? "Change" : "Add photo"}
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => !busy && !uploading && setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border hairline bg-paper p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-ink">
                Choose your try-on model
              </h3>
              <button
                type="button"
                onClick={() => !busy && !uploading && setOpen(false)}
                className="text-stone transition-colors hover:text-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-stone">
              Use a clear full-length photo (head to toe, plain background).
              Catalogue try-on will render garments on your selected photo.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {(photos ?? []).map((p) => (
                <div
                  key={p.storagePath}
                  className={`group relative overflow-hidden rounded-xl border ${
                    p.isDefault ? "border-brass" : "hairline"
                  }`}
                >
                  <button
                    type="button"
                    disabled={busy || uploading}
                    onClick={() => setDefault(p.storagePath)}
                    className="block w-full"
                    title={p.isDefault ? "Default" : "Set as default"}
                  >
                    <span className="relative block aspect-[3/4] w-full bg-cream/40">
                      <Image
                        src={p.url}
                        alt="Full-length photo"
                        fill
                        sizes="140px"
                        className="object-contain"
                        unoptimized
                      />
                    </span>
                    {p.isDefault ? (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-brass px-2 py-0.5 text-[10px] font-medium text-paper">
                        Default
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={busy || uploading}
                    onClick={() => remove(p.storagePath)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-ink/60 px-2 py-0.5 text-[10px] text-paper opacity-0 transition-opacity hover:bg-ink/80 group-hover:opacity-100 disabled:opacity-50"
                    title="Delete photo"
                  >
                    Delete
                  </button>
                </div>
              ))}

              <button
                type="button"
                disabled={uploading || busy}
                onClick={() => fileRef.current?.click()}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-cream/30 text-center text-xs text-stone transition-colors hover:border-brass/50 hover:text-ink disabled:opacity-50"
              >
                <span className="text-lg">＋</span>
                {uploading ? "Uploading…" : "Upload photo"}
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />

            {msg ? <p className="mt-3 text-xs text-rust">{msg}</p> : null}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => !busy && !uploading && setOpen(false)}
                className="rounded-full border hairline px-4 py-1.5 text-sm text-ink transition-colors hover:bg-cream/40"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
