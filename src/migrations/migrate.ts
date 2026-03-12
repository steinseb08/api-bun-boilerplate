import type { SQL } from "bun";
import { env } from "../provider/config";
import { getPostgresMigrationClient } from "../provider/db";

const migrationsPath = "src/migrations";

async function ensureMigrationsTable(client: SQL): Promise<void> {
  await client`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getAppliedVersions(client: SQL): Promise<Set<string>> {
  const rows = await client<{ version: string }[]>`SELECT version FROM schema_migrations`;
  return new Set(rows.map((row) => row.version));
}

async function getMigrationFiles(): Promise<string[]> {
  const files: string[] = [];
  const glob = new Bun.Glob("*.sql");

  for await (const file of glob.scan({ cwd: migrationsPath, absolute: false })) {
    files.push(file);
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function runPostgresMigrations(client: SQL): Promise<void> {
  await ensureMigrationsTable(client);
  const [files, applied] = await Promise.all([getMigrationFiles(), getAppliedVersions(client)]);

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await Bun.file(`${migrationsPath}/${file}`).text();
    await client.begin(async (tx) => {
      await tx.unsafe(sql);
      await tx`INSERT INTO schema_migrations ${tx({ version: file })}`;
    });
    console.log(`Applied migration: ${file}`);
  }

  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  console.log("Migrations complete.");
}

export async function runMigrations(): Promise<void> {
  if (env.DB_DRIVER !== "postgres") {
    console.log(`Skipping SQL migrations for DB_DRIVER=${env.DB_DRIVER} (SQLite bootstraps schema in provider/db.ts).`);
    return;
  }

  const client = getPostgresMigrationClient();
  if (!client) {
    throw new Error("Postgres migration client is not available");
  }

  await runPostgresMigrations(client);
}

if (import.meta.main) {
  runMigrations().catch((error) => {
    console.error("Migration failed", error);
    process.exit(1);
  });
}
