import { z } from "zod";

const sanitizeName = (value: string): string =>
  value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");

const EmailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.string().email());

export const CreateUserSchema = z.object({
  email: EmailSchema,
  fullName: z.string().min(2).max(120).transform(sanitizeName),
});

export const UserIdParamsSchema = z.object({
  id: z.uuid(),
});

export const ListUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(5000).optional(),
  cursor: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  if (value.offset !== undefined && value.cursor !== undefined) {
    ctx.addIssue({
      code: "custom",
      message: "offset and cursor cannot be used together",
      path: ["cursor"],
    });
  }
});
