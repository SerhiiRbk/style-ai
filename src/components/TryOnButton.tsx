"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ReportZoomImage } from "./ReportZoomImage";
import { useCredits } from "./CreditsContext";
import { MAX_TRYON_ITEMS, useTryOnSelection } from "./TryOnContext";

const LIVE = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function TryOnButton({
  productId,
  reportId,
  imageUrl,
  title,
  cost = 1,
}: {
  productId: string;
  reportId?: string;
  /** Fallback garment image when the DB row uses a site-relative path. */
  imageUrl?: string;
  /** Product title shown in the combined-outfit tray. */
  title?: string;
  /** Credit cost per try-on. */
  cost?: number;
}) {
  const { balance, setBalance } = useCredits();
  const selection = useTryOnSelection();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [hasFull, setHasFull] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const creditsApply = balance !== null;
  const insufficient = creditsApply && (balance ?? 0) < cost;
  const needsFullPhoto =
    errorCode === "needs_full_photo" || hasFull === false;

  useEffect(() => {
    if (!LIVE) return;
    void (async () => {
      try {
        const res = await fetch("/api/photos");
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (typeof data.hasFull === "boolean") setHasFull(data.hasFull);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function uploadFullPhoto(file: File) {
    if (!LIVE) return;
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
        body: JSON.stringify({ role: "full", storagePath }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not save photo");
      }

      setHasFull(true);
      setErrorCode(null);
      setMsg("Full-length photo saved — tap Try this on again.");
      setState("idle");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
      setState("error");
    } finally {
      setUploading(false);
    }
  }

  async function run() {
    if (insufficient) return;
    setState("loading");
    setMsg(null);
    setErrorCode(null);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, reportId, imageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        if (typeof data.balance === "number") setBalance(data.balance);
        if (typeof data.code === "string") setErrorCode(data.code);
        setMsg(data.error ?? "Try-on unavailable");
        return;
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      if (!data.url) {
        setState("error");
        setMsg("Try-on completed but preview is missing");
        return;
      }
      setUrl(data.url);
      setState("done");
    } catch {
      setState("error");
      setMsg("Try-on failed");
    }
  }

  const inSet = selection?.isSelected(productId) ?? false;
  const setFull = Boolean(selection?.full) && !inSet;

  return (
    <div className="mt-3 border-t border-paper/10 pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          onClick={run}
          disabled={state === "loading" || insufficient || uploading}
          title={
            insufficient ? "Not enough credits — top up to try on" : undefined
          }
          className="text-xs text-brass-soft transition-colors hover:text-paper disabled:opacity-50"
        >
          {state === "loading" ? "Generating try-on…" : "Try this on"}
          {state !== "loading" && (
            <span className="text-paper/40">
              {" "}
              · {cost} credit{cost === 1 ? "" : "s"} →
            </span>
          )}
        </button>
        {selection && (
          <button
            type="button"
            onClick={() =>
              selection.toggle({ productId, title: title ?? "Item", image: imageUrl })
            }
            disabled={setFull}
            title={
              setFull
                ? `Outfit set is full (${MAX_TRYON_ITEMS} max)`
                : "Combine up to 4 pieces in one try-on"
            }
            className={`text-[11px] transition-colors disabled:opacity-40 ${
              inSet
                ? "text-brass-soft hover:text-paper"
                : "text-paper/40 hover:text-paper"
            }`}
          >
            {inSet ? "✓ In outfit — remove" : "+ Add to outfit"}
          </button>
        )}
      </div>
      {creditsApply && insufficient && (
        <p className="mt-1 text-[11px] text-paper/40">
          Not enough credits ({balance} left).{" "}
          <Link href="/pricing" className="text-brass-soft hover:text-paper">
            Buy credits
          </Link>
        </p>
      )}
      {needsFullPhoto && LIVE && (
        <div className="mt-2 rounded-lg border border-paper/12 bg-paper/5 p-3">
          <p className="text-[11px] leading-relaxed text-paper/55">
            Try-on needs a <strong className="font-normal text-paper/80">full-length</strong> photo
            (head to toe, arms visible, plain background). A portrait alone will not work.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFullPhoto(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="mt-2 text-xs text-brass-soft transition-colors hover:text-paper disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload full-length photo →"}
          </button>
        </div>
      )}
      {errorCode === "body_pose_failed" && (
        <p className="mt-2 text-[11px] leading-relaxed text-paper/45">
          Stand straight, include your full body in frame, and avoid cropped mirror selfies.
          You can upload a better full-length photo above and try again.
        </p>
      )}
      {msg && <p className="mt-1 text-xs text-paper/40">{msg}</p>}
      {url && (
        <ReportZoomImage
          src={url}
          alt="Virtual try-on preview"
          className="w-full rounded-lg border border-paper/12"
          wrapperClassName="mt-2 block w-full"
        />
      )}
    </div>
  );
}
