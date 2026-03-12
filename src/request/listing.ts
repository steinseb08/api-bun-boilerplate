import { z } from "zod";

const QueryScalarSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}, z.union([z.string(), z.number(), z.boolean()]).optional());

function toOptionalString(value: unknown): string | undefined {
  const result = QueryScalarSchema.safeParse(value);
  if (!result.success || result.data === undefined) return undefined;
  return String(result.data);
}

export function normalizeQueryInput(input: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      normalized[key] = value.length <= 1 ? toOptionalString(value[0]) : value.map((item) => String(item));
      continue;
    }

    normalized[key] = toOptionalString(value);
  }
  return normalized;
}

export const CursorFirstPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
  offset: z.coerce.number().int().min(0).max(5000).optional(),
});
