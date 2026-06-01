import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

/** Load a feed body from a local file path or an HTTP(S) URL, transparently gunzipping. */
export async function loadFeed({ file, url }) {
  if (file) {
    const buf = await readFile(file);
    return maybeGunzip(buf, file).toString("utf8");
  }
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Feed fetch failed: ${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return maybeGunzip(buf, url).toString("utf8");
  }
  throw new Error("Provide --file or --url (or set the source's *_FEED_URL env).");
}

function maybeGunzip(buf, name) {
  const isGz = name.endsWith(".gz") || (buf[0] === 0x1f && buf[1] === 0x8b);
  return isGz ? gunzipSync(buf) : buf;
}
