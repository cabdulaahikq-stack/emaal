import rateLimit from "express-rate-limit";

/** Applied to /auth/* to blunt password/PIN brute-forcing by IP. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many attempts. Try again later." } },
});

/** Applied to money-moving customer routes (deposit/withdraw/transfer/PIN step-up). */
export const walletActionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many requests. Slow down." } },
});
