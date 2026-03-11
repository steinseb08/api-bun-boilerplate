import { STATUS_CODES } from "node:http";
import type { Request, Response } from "express";

export type ProblemDetails = {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  errors?: Record<string, string[]>;
} & Record<string, unknown>;

const RFC_TYPE_BY_STATUS: Record<number, string> = {
  400: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  401: "https://tools.ietf.org/html/rfc9110#section-15.5.2",
  403: "https://tools.ietf.org/html/rfc9110#section-15.5.4",
  404: "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  409: "https://tools.ietf.org/html/rfc9110#section-15.5.10",
  413: "https://tools.ietf.org/html/rfc9110#section-15.5.14",
  415: "https://tools.ietf.org/html/rfc9110#section-15.5.16",
  422: "https://tools.ietf.org/html/rfc9110#section-15.5.21",
  429: "https://tools.ietf.org/html/rfc6585#section-4",
  500: "https://tools.ietf.org/html/rfc9110#section-15.6.1",
  502: "https://tools.ietf.org/html/rfc9110#section-15.6.3",
  503: "https://tools.ietf.org/html/rfc9110#section-15.6.4",
};

function buildInstance(req: Request): string {
  return `${req.method} ${req.originalUrl || req.url}`;
}

function getDefaultTitle(status: number): string {
  return STATUS_CODES[status] ?? "Unknown Error";
}

function getDefaultType(status: number): string {
  return RFC_TYPE_BY_STATUS[status] ?? "about:blank";
}

export function buildProblemDetails(req: Request, problem: ProblemDetails): ProblemDetails {
  const merged: ProblemDetails = { ...problem };

  return {
    ...merged,
    type: merged.type ?? getDefaultType(merged.status),
    title: merged.title ?? getDefaultTitle(merged.status),
    instance: merged.instance ?? buildInstance(req),
  };
}

export function sendProblem(req: Request, res: Response, problem: ProblemDetails): Response {
  const payload = buildProblemDetails(req, problem);
  return res.status(problem.status).type("application/problem+json").json(payload);
}
