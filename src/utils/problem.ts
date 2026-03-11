import type { Response } from "express";

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  errors?: Record<string, string[]>;
};

export function sendProblem(res: Response, problem: ProblemDetails): Response {
  return res.status(problem.status).type("application/problem+json").json(problem);
}
