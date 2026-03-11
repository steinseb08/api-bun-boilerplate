import { Router } from "express";
import { ZodError } from "zod";
import { CreateUserSchema, ListUsersQuerySchema, UserIdParamsSchema } from "../request/users";
import { createUser, getUserById, listUsers } from "../repo/users";
import { sendProblem } from "../utils/problem";
import { zodErrorToFieldMap } from "../utils/validation";

export const usersRouter = Router();

usersRouter.get("/", async (req, res, next) => {
  try {
    const query = ListUsersQuerySchema.parse({
      limit: req.query.limit,
      offset: req.query.offset,
    });

    const users = await listUsers(query.limit, query.offset);
    return res.status(200).json({ data: users });
  } catch (error) {
    if (error instanceof ZodError) {
      return sendProblem(res, {
        type: "https://httpstatuses.com/400",
        title: "Bad Request",
        status: 400,
        detail: "Invalid query parameters",
        errors: zodErrorToFieldMap(error),
      });
    }

    return next(error);
  }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    const params = UserIdParamsSchema.parse({ id: req.params.id });
    const user = await getUserById(params.id);

    if (!user) {
      return sendProblem(res, {
        type: "https://httpstatuses.com/404",
        title: "Not Found",
        status: 404,
        detail: "User not found",
      });
    }

    return res.status(200).json({ data: user });
  } catch (error) {
    if (error instanceof ZodError) {
      return sendProblem(res, {
        type: "https://httpstatuses.com/400",
        title: "Bad Request",
        status: 400,
        detail: "Invalid path parameters",
        errors: zodErrorToFieldMap(error),
      });
    }

    return next(error);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const payload = CreateUserSchema.parse(req.body);
    const user = await createUser(payload);

    return res.status(201).json({ data: user });
  } catch (error) {
    if (error instanceof ZodError) {
      return sendProblem(res, {
        type: "https://httpstatuses.com/422",
        title: "Unprocessable Entity",
        status: 422,
        detail: "Validation failed",
        errors: zodErrorToFieldMap(error),
      });
    }

    const maybePgError = error as { code?: string };
    if (maybePgError.code === "23505") {
      return sendProblem(res, {
        type: "https://httpstatuses.com/409",
        title: "Conflict",
        status: 409,
        detail: "User already exists",
      });
    }

    return next(error);
  }
});
