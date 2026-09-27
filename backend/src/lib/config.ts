import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  approvalThresholdMinor: BigInt(Number(process.env.APPROVAL_THRESHOLD_USD ?? 5000) * 100),
  isProduction: process.env.NODE_ENV === "production",
};

if (config.isProduction && config.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}
