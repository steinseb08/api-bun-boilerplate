import { z } from "zod";

export type UsersCursor = {
  createdAt: string;
  id: string;
};

const UsersCursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.uuid(),
});

export function encodeUsersCursor(cursor: UsersCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeUsersCursor(raw: string): UsersCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid cursor encoding");
  }

  const result = UsersCursorSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Invalid cursor payload");
  }

  return result.data;
}
