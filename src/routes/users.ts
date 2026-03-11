import { Router } from "express";
import { ZodError } from "zod";
import { CreateUserSchema, ListUsersQuerySchema, UserIdParamsSchema } from "../request/users";
import { usersRepo, type IUsersRepo } from "../repo/users";
import { sendProblem } from "../utils/problem";
import { zodErrorToFieldMap } from "../utils/validation";

export function createUsersRouter(deps: { repo: IUsersRepo }): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const query = ListUsersQuerySchema.parse({
        limit: req.query.limit,
        offset: req.query.offset,
      });

      const users = await deps.repo.list(query.limit, query.offset);
      return res.status(200).json({
        data: users,
        meta: {
          limit: query.limit,
          offset: query.offset,
          count: users.length,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return sendProblem(req, res, {
          title: "Bad Request",
          status: 400,
          detail: "Invalid query parameters",
          errors: zodErrorToFieldMap(error),
        });
      }

      return next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const params = UserIdParamsSchema.parse({ id: req.params.id });
      const user = await deps.repo.getById(params.id);

      if (!user) {
        return sendProblem(req, res, {
          title: "Not Found",
          status: 404,
          detail: "User not found",
        });
      }

      return res.status(200).json({ data: user });
    } catch (error) {
      if (error instanceof ZodError) {
        return sendProblem(req, res, {
          title: "Bad Request",
          status: 400,
          detail: "Invalid path parameters",
          errors: zodErrorToFieldMap(error),
        });
      }

      return next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const payload = CreateUserSchema.parse(req.body);
      const user = await deps.repo.create(payload);

      return res.status(201).json({ data: user });
    } catch (error) {
      if (error instanceof ZodError) {
        return sendProblem(req, res, {
          title: "Unprocessable Entity",
          status: 422,
          detail: "Validation failed",
          errors: zodErrorToFieldMap(error),
        });
      }

      const maybePgError = error as { code?: string };
      if (maybePgError.code === "23505") {
        return sendProblem(req, res, {
          title: "Conflict",
          status: 409,
          detail: "User already exists",
        });
      }

      return next(error);
    }
  });

  return router;
}

export const usersRouter = createUsersRouter({ repo: usersRepo });
