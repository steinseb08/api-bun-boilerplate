import { SQL } from "bun";
import { Database } from "bun:sqlite";
import { env } from "./config";

export type SqlParam = string | number | boolean | null;

export interface AppDb {
  readonly driver: "postgres" | "sqlite";
  query<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  exec(sql: string, params?: SqlParam[]): Promise<void>;
  transaction<T>(fn: (tx: AppDb) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export interface TestDbControl {
  reset(): Promise<void>;
}

function mapSqliteError(error: unknown): unknown {
  const value = error as { message?: string; code?: string };
  if (value?.message?.toLowerCase().includes("unique") && value.code === undefined) {
    return Object.assign(new Error(value.message), { code: "23505" });
  }

  return error;
}

function postgresPlaceholderSql(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

class PostgresAppDb implements AppDb {
  readonly driver = "postgres" as const;

  constructor(private readonly client: SQL) {}

  async query<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    const rows = await this.client.unsafe(postgresPlaceholderSql(sql), params);
    return rows as T[];
  }

  async queryOne<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async exec(sql: string, params: SqlParam[] = []): Promise<void> {
    await this.client.unsafe(postgresPlaceholderSql(sql), params);
  }

  async transaction<T>(fn: (tx: AppDb) => Promise<T>): Promise<T> {
    return this.client.begin(async (tx) => {
      const wrapped = new PostgresAppDb(tx as unknown as SQL);
      return fn(wrapped);
    });
  }

  async ping(): Promise<void> {
    await this.client`SELECT 1`;
  }

  async close(): Promise<void> {
    if (typeof this.client.close === "function") {
      await this.client.close();
    }
  }
}

class SqliteAppDb implements AppDb, TestDbControl {
  readonly driver = "sqlite" as const;

  constructor(private readonly client: Database) {
    this.client.exec("PRAGMA foreign_keys = ON;");
    this.bootstrap();
  }

  private bootstrap(): void {
    this.client.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (
          lower(hex(randomblob(4))) || '-' ||
          lower(hex(randomblob(2))) || '-' ||
          '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
          substr('89ab', (abs(random()) % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
          lower(hex(randomblob(6)))
        ),
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        password_hash TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY DEFAULT (
          lower(hex(randomblob(4))) || '-' ||
          lower(hex(randomblob(2))) || '-' ||
          '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
          substr('89ab', (abs(random()) % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
          lower(hex(randomblob(6)))
        ),
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
      CREATE INDEX IF NOT EXISTS users_created_at_id_idx ON users(created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);
  }

  async query<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    try {
      const stmt = this.client.query(sql);
      return stmt.all(...params) as T[];
    } catch (error) {
      throw mapSqliteError(error);
    }
  }

  async queryOne<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async exec(sql: string, params: SqlParam[] = []): Promise<void> {
    try {
      const stmt = this.client.query(sql);
      stmt.run(...params);
    } catch (error) {
      throw mapSqliteError(error);
    }
  }

  async transaction<T>(fn: (tx: AppDb) => Promise<T>): Promise<T> {
    this.client.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn(this);
      this.client.exec("COMMIT");
      return result;
    } catch (error) {
      this.client.exec("ROLLBACK");
      throw error;
    }
  }

  async ping(): Promise<void> {
    this.client.query("SELECT 1").get();
  }

  async reset(): Promise<void> {
    this.client.exec(`
      DELETE FROM user_sessions;
      DELETE FROM users;
    `);
  }

  async close(): Promise<void> {
    this.client.close();
  }
}

const postgresClient = env.DB_DRIVER === "postgres"
  ? (env.DATABASE_URL ? new SQL(env.DATABASE_URL) : Bun.sql)
  : null;

const sqliteClient = env.DB_DRIVER === "sqlite"
  ? new Database(env.SQLITE_FILENAME)
  : null;

export const appDb: AppDb = env.DB_DRIVER === "sqlite"
  ? new SqliteAppDb(sqliteClient as Database)
  : new PostgresAppDb(postgresClient as SQL);

export const db = appDb;

export async function closeDb(): Promise<void> {
  await appDb.close();
}

export async function resetTestDb(): Promise<void> {
  if (appDb.driver !== "sqlite") {
    throw new Error("resetTestDb is only available when DB_DRIVER=sqlite");
  }

  await (appDb as SqliteAppDb).reset();
}

export function getPostgresMigrationClient(): SQL | null {
  return postgresClient;
}
