export type ArchivedLookImage = {
  path: string;
  title: string;
  createdAt: string;
};

export function parseArchivedLookImages(raw: unknown): ArchivedLookImage[] {
  if (!Array.isArray(raw)) return [];
  const out: ArchivedLookImage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const path = (item as { path?: unknown }).path;
    const title = (item as { title?: unknown }).title;
    const createdAt = (item as { createdAt?: unknown }).createdAt;
    if (typeof path !== "string" || !path) continue;
    out.push({
      path,
      title: typeof title === "string" && title ? title : "Look",
      createdAt:
        typeof createdAt === "string" && createdAt
          ? createdAt
          : new Date().toISOString(),
    });
  }
  return out;
}
