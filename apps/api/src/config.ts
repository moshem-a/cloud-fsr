import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // GCP
  GCP_PROJECT_ID: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),

  // Allowed sign-in domain (locked to @google.com per requirements)
  ALLOWED_EMAIL_DOMAIN: z.string().default("google.com"),

  // CORS
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten());
    process.exit(1);
  }
  return parsed.data;
}
