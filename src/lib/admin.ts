/**
 * Admin gating. The catalogue tools (manual refresh) are restricted to the
 * emails listed in ADMIN_EMAILS (comma-separated). No row in the DB is needed.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
