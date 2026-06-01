import { NextResponse } from "next/server";
import { getGeo } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns the visitor's detected location + default currencies. */
export async function GET() {
  const geo = await getGeo();
  return NextResponse.json(geo);
}
