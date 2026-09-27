import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors.js";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: "validation_error", message: err.issues.map((i) => i.message).join("; ") } });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  req.log?.error({ err }, "unhandled_error");
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
}
