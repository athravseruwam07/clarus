import { decryptString } from "./encryption.js";
import { AppError } from "./errors.js";

export function decodeStorageState(encryptedState: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(decryptString(encryptedState));
  } catch {
    throw new AppError(500, "stored session state is invalid", "invalid_stored_state");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AppError(500, "stored session state is invalid", "invalid_stored_state");
  }

  return parsed as Record<string, unknown>;
}
