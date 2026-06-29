export type AuthErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

const statusByCode: Record<AuthErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

export class AuthError extends Error {
  override readonly name = "AuthError";
  readonly status: number;

  constructor(
    readonly code: AuthErrorCode,
    message: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.status = options?.status ?? statusByCode[code];
  }
}

export function badRequest(message: string): AuthError {
  return new AuthError("BAD_REQUEST", message);
}

export function unauthorized(message = "Unauthorized"): AuthError {
  return new AuthError("UNAUTHORIZED", message);
}

export function forbidden(message = "Forbidden"): AuthError {
  return new AuthError("FORBIDDEN", message);
}

export function notFound(message = "Not found"): AuthError {
  return new AuthError("NOT_FOUND", message);
}

export function conflict(message: string): AuthError {
  return new AuthError("CONFLICT", message);
}

export function internal(message = "Internal error"): AuthError {
  return new AuthError("INTERNAL", message);
}
