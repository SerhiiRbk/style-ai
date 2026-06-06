import type { CanonicalProduct } from "../../scripts/feeds/run.d.mts";

export type FeedJob = { sourceKey: string; url: string };
export type SourceSummary = {
  source: string;
  valid: number;
  invalid: number;
  upserted: number;
  error?: string;
};

const CHUNK_SIZE = 50;

/** Step: parse + map + validate one feed (full Node access, retryable). */
async function prepareSource(sourceKey: string, url: string, limit?: number) {
  "use step";
  console.log(`[catalog] preparing ${sourceKey}`);
  const { prepareFeed } = await import("../../scripts/feeds/run.mjs");
  const fxRates = process.env.FX_RATES
    ? (JSON.parse(process.env.FX_RATES) as Record<string, number>)
    : undefined;
  const res = await prepareFeed({ sourceKey, url, limit, fxRates });
  console.log(
    `[catalog] ${sourceKey}: ${res.valid} valid, ${res.invalid} invalid, ${res.products.length} to ingest`,
  );
  return res;
}

/** Step: embed + upsert a chunk of products. Retried independently on failure. */
async function ingestChunk(products: CanonicalProduct[]): Promise<number> {
  "use step";
  if (products.length === 0) return 0;
  const { embedAndUpsert } = await import("../../scripts/feeds/upsert.mjs");
  const n = await embedAndUpsert(products, { sourceType: "feed" });
  console.log(`[catalog] upserted chunk of ${n}`);
  return n;
}

/**
 * Durable catalogue refresh. Each source is prepared in its own retryable step;
 * products are then ingested in small chunks so a transient embedding/DB error
 * only retries that chunk. Survives crashes and resumes from the last step.
 */
export async function refreshCatalogWorkflow(
  jobs: FeedJob[],
  limit?: number,
): Promise<SourceSummary[]> {
  "use workflow";
  console.log(`[catalog] refresh started for ${jobs.length} source(s)`);

  const summary: SourceSummary[] = [];

  for (const job of jobs) {
    try {
      const prep = await prepareSource(job.sourceKey, job.url, limit);
      let upserted = 0;
      for (let i = 0; i < prep.products.length; i += CHUNK_SIZE) {
        const chunk = prep.products.slice(i, i + CHUNK_SIZE);
        upserted += await ingestChunk(chunk);
      }
      summary.push({
        source: job.sourceKey,
        valid: prep.valid,
        invalid: prep.invalid,
        upserted,
      });
    } catch (e) {
      summary.push({
        source: job.sourceKey,
        valid: 0,
        invalid: 0,
        upserted: 0,
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }

  console.log(`[catalog] refresh complete`);
  return summary;
}
