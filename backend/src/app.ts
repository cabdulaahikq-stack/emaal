import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { authRouter } from "./routes/auth.js";
import { walletRouter } from "./routes/wallet.js";
import { adminRouter } from "./routes/admin.js";
import { adminPartnersRouter } from "./routes/adminPartners.js";
import { partnerApiRouter } from "./routes/partnerApi.js";
import { authRateLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiDocsMarkdown } from "./docs.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "256kb" }));
  if (process.env.NODE_ENV !== "test") {
    app.use(pinoHttp());
  }

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/v1/docs", (_req, res) => res.type("text/markdown").send(apiDocsMarkdown));

  app.use("/auth", authRateLimiter, authRouter);
  app.use("/wallet", walletRouter);
  app.use("/admin/partners", adminPartnersRouter);
  app.use("/admin", adminRouter);
  app.use("/v1", partnerApiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
