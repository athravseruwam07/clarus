const requiredEnv = [
  "PORT",
  "DATABASE_URL",
  "ENCRYPTION_KEY",
  "SESSION_SECRET",
  "CORS_ORIGIN",
  "CONNECTOR_URL",
  "CONNECTOR_INTERNAL_SECRET"
] as const;

type RequiredEnvKey = (typeof requiredEnv)[number];

function getEnv(key: RequiredEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`missing env var: ${key}`);
  }

  return value;
}

export const env = {
  PORT: Number(getEnv("PORT")),
  DATABASE_URL: getEnv("DATABASE_URL"),
  ENCRYPTION_KEY: getEnv("ENCRYPTION_KEY"),
  SESSION_SECRET: getEnv("SESSION_SECRET"),
  CORS_ORIGIN: getEnv("CORS_ORIGIN"),
  CONNECTOR_URL: getEnv("CONNECTOR_URL").replace(/\/$/, ""),
  CONNECTOR_INTERNAL_SECRET: getEnv("CONNECTOR_INTERNAL_SECRET")
};
