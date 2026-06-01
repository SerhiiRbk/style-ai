#!/usr/bin/env node
// Applies supabase/migrations/*.sql to the database in DATABASE_URL.
// Each file runs in its own transaction and is recorded in schema_migrations,
// so re-runs skip already-applied files. Usage:
//   node --env-file=.env.local scripts/db-migrate.mjs
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL (Supabase Postgres connection string).");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(
    `create table if not exists public.schema_migrations (
       version text primary key,
       applied_at timestamptz not null default now()
     )`,
  );

  const { rows } = await client.query(
    "select version from public.schema_migrations",
  );
  const applied = new Set(rows.map((r) => r.version));

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`• skip   ${file} (already applied)`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`• apply  ${file} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations(version) values($1)",
        [file],
      );
      await client.query("commit");
      console.log("ok");
    } catch (e) {
      await client.query("rollback");
      console.log("FAILED");
      throw e;
    }
  }

  console.log("\nDone. All migrations applied.");
}

main()
  .catch((e) => {
    console.error("\nMigration error:", e.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
