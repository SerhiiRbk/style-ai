import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";

/** Download investor deck PPTX — admins only (not served from /public). */
export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const filePath = path.join(
    process.cwd(),
    "docs/investors/valetti-investor-deck-en.pptx",
  );

  try {
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition":
          'attachment; filename="valetti-investor-deck-en.pptx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Deck file not found. Run npm run deck:pptx on the server." },
      { status: 404 },
    );
  }
}
