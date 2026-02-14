import { z } from "zod";

export const instanceUrlSchema = z
  .string()
  .trim()
  .url("instanceUrl must be a valid url")
  .refine((value) => value.startsWith("https://"), "instanceUrl must start with https://");

export const connectBodySchema = z.object({
  instanceUrl: instanceUrlSchema,
  username: z.string().trim().min(1).optional(),
  // password is optional in manual mode (user signs in inside the playwright tab)
  password: z.string().min(1).optional(),
  mode: z.enum(["manual", "credentials"]).optional()
}).superRefine((value, ctx) => {
  const hasPassword = typeof value.password === "string" && value.password.length > 0;
  const wantsCredentials =
    value.mode === "credentials" || (hasPassword && value.mode !== "manual");

  if (!wantsCredentials) {
    return;
  }

  if (!value.username) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "username is required for credential login",
      path: ["username"]
    });
  }

  if (!hasPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "password is required for credential login",
      path: ["password"]
    });
  }
});

export const connectorRequestSchema = z.object({
  instanceUrl: instanceUrlSchema,
  apiPath: z
    .string()
    .trim()
    .min(1)
    .refine((value) => value.startsWith("/d2l/api/"), "apiPath must start with /d2l/api/")
});
