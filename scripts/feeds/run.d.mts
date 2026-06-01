export interface ImportOptions {
  sourceKey: string;
  file?: string;
  url?: string;
  dryRun?: boolean;
  limit?: number;
  fxRates?: Record<string, number>;
  model?: string;
}

export interface ImportSummary {
  sourceKey: string;
  label: string;
  parsed: number;
  canonical: number;
  valid: number;
  invalid: number;
  upserted: number;
  firstIssue: { path?: (string | number)[]; message: string } | null;
  samples: Array<Record<string, unknown>>;
}

export interface SourceConfig {
  label: string;
  format: "delimited" | "xml" | "json";
  urlEnv: string;
}

export interface CanonicalProduct {
  source: string;
  externalId: string;
  title: string;
  category: string;
  price: number;
  currency: string;
  priceEur: number;
  market?: "EU" | "US";
  deeplink: string;
  [key: string]: unknown;
}

export interface PrepareResult {
  label: string;
  parsed: number;
  canonical: number;
  valid: number;
  invalid: number;
  firstIssue: { path?: (string | number)[]; message: string } | null;
  products: CanonicalProduct[];
}

export function prepareFeed(opts: {
  sourceKey: string;
  file?: string;
  url?: string;
  fxRates?: Record<string, number>;
  limit?: number;
}): Promise<PrepareResult>;
export function importFeed(opts: ImportOptions): Promise<ImportSummary>;
export function listSources(): string[];
export function sourceConfig(key: string): SourceConfig | undefined;
