import { z } from "zod";
import { CursorFirstPaginationSchema } from "./listing";

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

const UsersSortBySchema = z.enum(["createdAt", "email", "fullName"]).default("createdAt");
const UsersSortOrderSchema = z.enum(["asc", "desc"]).default("desc");

export const ListUsersQuerySchema = CursorFirstPaginationSchema.extend({
  sortBy: UsersSortBySchema.optional().default("createdAt"),
  sortOrder: UsersSortOrderSchema.optional().default("desc"),
  q: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().optional(),
  createdFrom: z.string().datetime({ offset: true }).optional(),
  createdTo: z.string().datetime({ offset: true }).optional(),
})
  .strict()
  .superRefine((value, ctx) => {
  if (value.offset !== undefined && value.cursor !== undefined) {
    ctx.addIssue({
      code: "custom",
      message: "offset and cursor cannot be used together",
      path: ["cursor"],
    });
  }

  if (value.cursor !== undefined && value.sortBy !== "createdAt") {
    ctx.addIssue({
      code: "custom",
      message: "cursor mode only supports sortBy=createdAt",
      path: ["sortBy"],
    });
  }

  if (value.cursor !== undefined && value.sortOrder !== "desc") {
    ctx.addIssue({
      code: "custom",
      message: "cursor mode only supports sortOrder=desc",
      path: ["sortOrder"],
    });
  }

  if (value.offset === undefined && value.sortBy !== "createdAt") {
    ctx.addIssue({
      code: "custom",
      message: "sortBy other than createdAt requires offset mode",
      path: ["sortBy"],
    });
  }

  if (value.offset === undefined && value.sortOrder !== "desc") {
    ctx.addIssue({
      code: "custom",
      message: "sortOrder=asc requires offset mode",
      path: ["sortOrder"],
    });
  }

  if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
    ctx.addIssue({
      code: "custom",
      message: "createdFrom cannot be after createdTo",
      path: ["createdTo"],
    });
  }
});
