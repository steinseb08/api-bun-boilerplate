import { z } from "zod";

const sanitizeName = (value: string): string =>
  value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");

export const CreateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().min(2).max(120).transform(sanitizeName),
});

export const UserIdParamsSchema = z.object({
  id: z.uuid(),
});

export const ListUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
});
