import { db } from "../provider/db";

const migrationsPath = "src/migrations";

async function ensureMigrationsTable(): Promise<void> {
  await db`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getAppliedVersions(): Promise<Set<string>> {
  const rows = await db<{ version: string }[]>`SELECT version FROM schema_migrations`;
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

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();

  const [files, applied] = await Promise.all([getMigrationFiles(), getAppliedVersions()]);

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await Bun.file(`${migrationsPath}/${file}`).text();

    await db.begin(async (tx) => {
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

if (import.meta.main) {
  runMigrations().catch((error) => {
    console.error("Migration failed", error);
    process.exit(1);
  });
}
