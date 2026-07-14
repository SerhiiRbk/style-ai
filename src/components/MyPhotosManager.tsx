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
 * Private manager for the user's uploaded full-length reference photos: upload,
 * set the default try-on model, and delete. These are sensitive/biometric, so
 * they live in their own private page rather than the public looks gallery.
 */
export function MyPhotosManager() {
  const [photos, setPhotos] = useState<ModelPhoto[] | null>(null);
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

      const makeDefault = !(photos ?? []).some((p) => p.isDefault);
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "full", storagePath, makeDefault }),
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

  const list = photos ?? [];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => (
          <div
            key={p.storagePath}
            className={`group relative overflow-hidden rounded-xl border ${
              p.isDefault ? "border-brass" : "hairline"
            }`}
          >
            <span className="relative block aspect-[3/4] w-full bg-cream/40">
              <Image
                src={p.url}
                alt="Full-length photo"
                fill
                sizes="200px"
                className="object-contain"
                unoptimized
              />
            </span>
            {p.isDefault ? (
              <span className="absolute left-2 top-2 rounded-full bg-brass px-2 py-0.5 text-[10px] font-medium text-paper">
                Default
              </span>
            ) : null}
            <div className="flex items-center justify-between gap-2 p-2">
              <button
                type="button"
                disabled={busy || uploading || p.isDefault}
                onClick={() => setDefault(p.storagePath)}
                className="rounded-full border border-brass/40 bg-brass/5 px-2.5 py-1 text-[11px] text-ink transition-colors hover:border-brass/60 hover:bg-brass/10 disabled:opacity-50"
              >
                {p.isDefault ? "Default" : "Set default"}
              </button>
              <button
                type="button"
                disabled={busy || uploading}
                onClick={() => remove(p.storagePath)}
                className="rounded-full border hairline px-2.5 py-1 text-[11px] text-stone transition-colors hover:text-ink disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          disabled={uploading || busy}
          onClick={() => fileRef.current?.click()}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-cream/30 text-center text-xs text-stone transition-colors hover:border-brass/50 hover:text-ink disabled:opacity-50"
        >
          <span className="text-2xl">＋</span>
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

      {msg ? <p className="mt-4 text-sm text-rust">{msg}</p> : null}

      {!list.length && !uploading ? (
        <p className="mt-6 text-sm text-stone">
          No photos yet. Upload a clear full-length photo (head to toe, plain
          background) to use as your try-on model.
        </p>
      ) : null}
    </div>
  );
}
