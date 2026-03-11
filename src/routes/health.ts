import { Router } from "express";
import { db } from "../provider/db";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    await db`SELECT 1 as ok`;
    return res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: { db: "ok" },
    });
  } catch {
    return res.status(503).json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      services: { db: "down" },
    });
  }
});
