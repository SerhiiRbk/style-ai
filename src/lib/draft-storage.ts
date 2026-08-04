/**
 * Client-side report draft (§5.4, variant C). An anonymous visitor fills the
 * wizard, and their answers + photos live on THIS device until they register —
 * nothing hits our servers before auth. Answers are small JSON (localStorage);
 * photos are Blobs (IndexedDB, since a 4 MB photo won't fit localStorage's ~5 MB
 * quota once base64-inflated). Shared with the colours try-on continuity flow.
 *
 * Everything here is best-effort and browser-only: on the server, or when
 * storage is unavailable/over quota, calls degrade to no-ops so the wizard still
 * works (just without cross-navigation persistence).
 */

const ANSWERS_KEY = "valetti_report_draft";
const PENDING_KEY = "valetti_report_pending";
const ANSWERS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // answers live 7 days
const PHOTOS_TTL_MS = 24 * 60 * 60 * 1000; // photos live 24 hours

/** All wizard answers needed to resume + submit a report after registration. */
export type DraftAnswers = {
  step: number;
  age: number;
  gender: string;
  city: string;
  country: string;
  currency: string;
  language: string;
  height: number;
  weight: string;
  bodyType: string;
  bodyTypeManual: boolean;
  hairColor: string;
  eyeColor: string;
  shoulderCm: string;
  chestCm: string;
  waistCm: string;
  hipCm: string;
  sleeveCm: string;
  occupation: string;
  lifestyle: string[];
  goals: string[];
  boldness: string;
  budget: number;
  tier: string;
  biometricConsent: boolean;
  /** Stable idempotency key so a resume can't double-charge (matches /api/reports). */
  reportId: string;
};

type StoredAnswers = { savedAt: number; answers: DraftAnswers };

/** Persist wizard answers. Returns false on quota/serialisation failure. */
export function saveDraftAnswers(answers: DraftAnswers): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload: StoredAnswers = { savedAt: Date.now(), answers };
    localStorage.setItem(ANSWERS_KEY, JSON.stringify(payload));
    return true;
  } catch {
    // QuotaExceededError or private-mode restriction — caller shows a notice.
    return false;
  }
}

/** Load wizard answers, or null when absent/expired (expired entries self-clear). */
export function loadDraftAnswers(): DraftAnswers | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ANSWERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAnswers;
    if (!parsed?.answers || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > ANSWERS_TTL_MS) {
      clearDraftAnswers();
      return null;
    }
    return parsed.answers;
  } catch {
    return null;
  }
}

export function clearDraftAnswers(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ANSWERS_KEY);
  } catch {
    /* ignore */
  }
}

/** Mark that a draft is awaiting registration, so /start resumes after auth. */
export function setDraftPending(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isDraftPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearDraftPending(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Photo blobs — IndexedDB (localStorage can't hold multi-MB binary).
// ---------------------------------------------------------------------------

const DB_NAME = "valetti-drafts";
const DB_VERSION = 1;
const PHOTO_STORE = "photos";

export type StagedPhoto = {
  role: string;
  blob: Blob;
  name: string;
  type: string;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE)) {
          db.createObjectStore(PHOTO_STORE, { keyPath: "role" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Stage one photo blob for a role (replaces any prior blob for that role). */
export async function savePhotoBlob(role: string, file: File): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      const record: StagedPhoto = {
        role,
        blob: file,
        name: file.name || `${role}.jpg`,
        type: file.type || "image/jpeg",
        savedAt: Date.now(),
      };
      tx.objectStore(PHOTO_STORE).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

/** Load all staged photos, dropping (and deleting) any past the 24h TTL. */
export async function loadPhotoBlobs(): Promise<StagedPhoto[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE, "readonly");
      const req = tx.objectStore(PHOTO_STORE).getAll();
      req.onsuccess = () => {
        const all = (req.result as StagedPhoto[]) ?? [];
        const fresh = all.filter((p) => Date.now() - p.savedAt <= PHOTOS_TTL_MS);
        db.close();
        if (fresh.length !== all.length) void clearPhotoBlobsExpired();
        resolve(fresh);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      resolve([]);
    }
  });
}

export async function clearPhotoBlobs(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      tx.objectStore(PHOTO_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** Delete only expired blobs (best-effort GC during load). */
async function clearPhotoBlobsExpired(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      const store = tx.objectStore(PHOTO_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        for (const p of (req.result as StagedPhoto[]) ?? []) {
          if (Date.now() - p.savedAt > PHOTOS_TTL_MS) store.delete(p.role);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** Wipe the whole client draft (answers + pending flag + photos) after success. */
export async function clearDraft(): Promise<void> {
  clearDraftAnswers();
  clearDraftPending();
  await clearPhotoBlobs();
}
