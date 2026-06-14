import { NextResponse } from "next/server";
import { getGeoPrefill } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns the visitor's detected location + default currencies. */
export async function GET(request: Request) {
  const geo = await getGeoPrefill(request.headers);
  return NextResponse.json(geo);
}
