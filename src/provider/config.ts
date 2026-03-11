import { z } from "zod";

const NodeEnvSchema = z.enum(["development", "test", "production"]);

const EnvSchema = z
  .object({
    NODE_ENV: NodeEnvSchema.default("development"),
    HOST: z.string().trim().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().trim().min(1).optional(),
    REDIS_URL: z.string().trim().min(1).optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    CORS_ORIGINS: z.string().trim().default(""),
    BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).max(10_485_760).default(1_048_576),
  })
  .transform((raw) => ({
    ...raw,
    CORS_ORIGINS: raw.CORS_ORIGINS
      ? raw.CORS_ORIGINS.split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  }));

const parsed = EnvSchema.safeParse(Bun.env);

if (!parsed.success) {
  throw new Error(`Invalid environment:\n${parsed.error.message}`);
}

if (!parsed.data.DATABASE_URL && parsed.data.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
