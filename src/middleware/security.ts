import type { RequestHandler } from "express";
import { sendProblem } from "../utils/problem";

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

export function createSecurityHeadersMiddleware(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader("x-dns-prefetch-control", "off");
    res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("cross-origin-resource-policy", "same-origin");
    next();
  };
}

export function createJsonContentTypeMiddleware(): RequestHandler {
  return (req, res, next) => {
    if (!METHODS_WITH_BODY.has(req.method)) {
      return next();
    }

    const hasBody = (req.header("content-length") ?? "0") !== "0" || Boolean(req.header("transfer-encoding"));
    if (!hasBody) {
      return next();
    }

    if (!req.is("application/json")) {
      return sendProblem(req, res, {
        status: 415,
        detail: "Content-Type must be application/json",
        requestId: res.locals.requestId,
      });
    }

    return next();
  };
}
