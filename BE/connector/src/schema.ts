import { z } from "zod";

export const loginSchema = z.object({
  instanceUrl: z
    .string()
    .trim()
    .url("instanceUrl must be a valid url")
    .refine((value) => value.startsWith("https://"), "instanceUrl must start with https://"),
  username: z.string().trim().min(1, "username is required"),
  password: z.string().min(1, "password is required")
});

export const requestSchema = z.object({
  instanceUrl: z
    .string()
    .trim()
    .url("instanceUrl must be a valid url")
    .refine((value) => value.startsWith("https://"), "instanceUrl must start with https://"),
  storageState: z.record(z.unknown()),
  apiPath: z
    .string()
    .trim()
    .min(1)
    .refine((value) => value.startsWith("/d2l/api/"), "apiPath must start with /d2l/api/")
});
