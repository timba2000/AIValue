export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof Error) {
    return /^401/.test(error.message) || error.message.includes("Unauthorized");
  }
  return false;
}
