import { buildLlmsTxt } from "@/lib/llms-txt";

export const dynamic = "force-static";

/** https://llmstxt.org — curated map for LLM agents and dev tools. */
export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
