import express from "express";
import { healthRouter } from "./routes/health";
import { usersRouter } from "./routes/users";
import { sendProblem } from "./utils/problem";
import { env } from "./provider/config";

export const app = express();

app.use(express.json({ limit: env.BODY_LIMIT_BYTES }));

app.use("/healthz", healthRouter);
app.use("/api/v1/users", usersRouter);

app.use((req, res) => {
  return sendProblem(res, {
    type: "https://httpstatuses.com/404",
    title: "Not Found",
    status: 404,
    detail: `Route ${req.method} ${req.path} not found`,
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const typedError = error as { type?: string; status?: number };

  if (typedError.type === "entity.too.large") {
    return sendProblem(res, {
      type: "https://httpstatuses.com/413",
      title: "Payload Too Large",
      status: 413,
      detail: "Request body exceeds max size",
    });
  }

  if (typedError.status === 400) {
    return sendProblem(res, {
      type: "https://httpstatuses.com/400",
      title: "Bad Request",
      status: 400,
      detail: "Invalid JSON payload",
    });
  }

  return sendProblem(res, {
    type: "https://httpstatuses.com/500",
    title: "Internal Server Error",
    status: 500,
    detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
  });
});
