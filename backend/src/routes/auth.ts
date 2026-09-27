import { Router } from "express";
import { z } from "zod";
import * as authService from "../services/authService.js";
import { requireAuth } from "../middleware/auth.js";
import { authRateLimiter } from "../middleware/rateLimit.js";

export const authRouter = Router();

const signupSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().regex(/^\+?\d{9,15}$/, "Phone must be 9-15 digits, optionally starting with +"),
  password: z.string().min(8).max(200),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

authRouter.post("/signup", async (req, res, next) => {
  try {
    const input = signupSchema.parse(req.body);
    const { user, token } = await authService.signup(input);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

const merchantSignupSchema = signupSchema.extend({ shopName: z.string().min(2).max(120) });

authRouter.post("/merchant-signup", async (req, res, next) => {
  try {
    const input = merchantSignupSchema.parse(req.body);
    const { user, token } = await authService.merchantSignup(input);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { phone, password } = loginSchema.parse(req.body);
    const { user, token } = await authService.login(phone, password);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

function publicUser(user: { id: string; fullName: string; phone: string; role: string }) {
  return { id: user.id, fullName: user.fullName, phone: user.phone, role: user.role };
}

const verifyPinSchema = z.object({ pin: z.string().regex(/^\d{4}$/) });

// Used only to re-unlock an already-authenticated app session (e.g. after
// the app was backgrounded). It is NOT a substitute for the per-transaction
// PIN step-up baked into /wallet/deposit, /withdraw and /transfer — those
// re-verify the PIN themselves so a stolen unlocked session still can't move
// money without it.
authRouter.post("/verify-pin", authRateLimiter, requireAuth, async (req, res, next) => {
  try {
    const { pin } = verifyPinSchema.parse(req.body);
    await authService.verifyPin(req.session!.sub, pin);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
