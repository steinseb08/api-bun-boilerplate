import type { RequestHandler } from "express";
import type { Logger } from "../provider/logger";

function getRequestId(headerValue: string | undefined): string {
  if (headerValue && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  return crypto.randomUUID();
}

export function createRequestLoggingMiddleware(baseLogger: Logger): RequestHandler {
  return (req, res, next) => {
    const startedAt = Date.now();
    const requestId = getRequestId(req.header("x-request-id") ?? undefined);
    const requestLogger = baseLogger.child({ requestId });

    res.locals.requestId = requestId;
    res.setHeader("x-request-id", requestId);

    requestLogger.info("request.started", {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.header("user-agent") ?? "unknown",
    });

    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;

      requestLogger.info("request.completed", {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      });
    });

    next();
  };
}
