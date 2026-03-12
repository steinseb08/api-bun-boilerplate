import { z } from "zod";

const NodeEnvSchema = z.enum(["development", "test", "production"]);
const BooleanEnvSchema = z.preprocess((value) => {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());
const TrustProxyEnvSchema = z.preprocess((value) => {
  if (value === undefined || value === "") return false;
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  if (typeof value === "string") return value;
  return false;
}, z.union([z.boolean(), z.string().trim().min(1)]));

const EnvSchema = z
  .object({
    NODE_ENV: NodeEnvSchema.default("development"),
    APP_FRAMEWORK: z.enum(["express", "elysia"]).default("express"),
    DB_DRIVER: z.enum(["postgres", "sqlite"]).optional(),
    HOST: z.string().trim().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    TRUST_PROXY: TrustProxyEnvSchema.default(false),

    DATABASE_URL: z.string().trim().min(1).optional(),
    SQLITE_FILENAME: z.string().trim().min(1).optional(),
    REDIS_URL: z.string().trim().min(1).optional(),
    CACHE_MODE: z.enum(["noop", "memory", "redis"]).optional(),

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

    BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).max(10_485_760).default(1_048_576),
    HTTP_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(8_000),

    SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(60 * 60 * 24 * 30).default(60 * 60 * 24 * 7),
    PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(128).default(10),
    PASSWORD_MAX_LENGTH: z.coerce.number().int().min(8).max(256).default(128),
    PASSWORD_HASH_ALGORITHM: z.enum(["argon2id", "argon2i", "argon2d", "bcrypt"]).default("argon2id"),
    PASSWORD_BCRYPT_COST: z.coerce.number().int().min(4).max(31).default(10),
    PASSWORD_ARGON_MEMORY_COST: z.coerce.number().int().min(16 * 1024).max(1024 * 1024).default(64 * 1024),
    PASSWORD_ARGON_TIME_COST: z.coerce.number().int().min(1).max(10).default(2),

    AUTH_RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().min(1).max(3600).default(60),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(20),
    GLOBAL_RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().min(1).max(3600).default(60),
    GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(300),

    READINESS_CHECK_CACHE: BooleanEnvSchema.default(false),
  })
  .superRefine((raw, ctx) => {
    if (raw.PASSWORD_MIN_LENGTH > raw.PASSWORD_MAX_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: "PASSWORD_MIN_LENGTH cannot be greater than PASSWORD_MAX_LENGTH",
      });
    }

    if (raw.PASSWORD_HASH_ALGORITHM !== "bcrypt" && raw.PASSWORD_BCRYPT_COST !== 10) {
      ctx.addIssue({
        code: "custom",
        message: "PASSWORD_BCRYPT_COST is set but PASSWORD_HASH_ALGORITHM is not bcrypt",
      });
    }
  });

const parsed = EnvSchema.safeParse(Bun.env);

if (!parsed.success) {
  throw new Error(`Invalid environment:\n${parsed.error.message}`);
}

const resolvedDbDriver = parsed.data.DB_DRIVER ?? (parsed.data.NODE_ENV === "test" ? "sqlite" : "postgres");
const resolvedSqliteFilename = parsed.data.SQLITE_FILENAME ?? ":memory:";

if (resolvedDbDriver === "postgres" && !parsed.data.DATABASE_URL && parsed.data.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

if (parsed.data.CACHE_MODE === "redis" && !parsed.data.REDIS_URL) {
  throw new Error("REDIS_URL is required when CACHE_MODE=redis");
}

if (resolvedDbDriver === "postgres" && !parsed.data.DATABASE_URL && parsed.data.NODE_ENV !== "test") {
  throw new Error("DATABASE_URL is required when DB_DRIVER=postgres");
}

export const env = {
  ...parsed.data,
  DB_DRIVER: resolvedDbDriver,
  SQLITE_FILENAME: resolvedSqliteFilename,
};
export const isProduction = env.NODE_ENV === "production";
