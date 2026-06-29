import { unauthorized } from "./errors";
import type { AuthService } from "./services/auth-service";
import type { AuthenticatedActor, SessionActor } from "./types";

export type HeaderValue = string | string[] | undefined | null;
export type HeadersLike =
  | Record<string, HeaderValue>
  | {
      get(name: string): string | null;
    };

export type ActorResolver = (input: {
  headers: HeadersLike;
  bearerToken: string | null;
}) => Promise<AuthenticatedActor | null>;

export function getHeader(headers: HeadersLike, name: string): string | null {
  const getter = (headers as { get?: unknown }).get;
  if (typeof getter === "function") {
    return (getter as (headerName: string) => string | null)(name);
  }

  const record = headers as Record<string, HeaderValue>;
  const direct = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0] ?? null;
  return direct ?? null;
}

export function getBearerToken(headers: HeadersLike): string | null {
  const authorization = getHeader(headers, "authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length);
}

export async function resolveSessionActor(
  headers: HeadersLike,
  authService: AuthService,
): Promise<SessionActor> {
  const token = getBearerToken(headers);
  if (!token) {
    throw unauthorized("Missing bearer token");
  }

  const auth = await authService.verifySessionToken(token);
  return {
    type: "user",
    user: auth.user,
    session: auth.session,
  };
}

export async function resolveActor(
  headers: HeadersLike,
  authService: AuthService,
  resolvers: ActorResolver[] = [],
): Promise<AuthenticatedActor> {
  const bearerToken = getBearerToken(headers);

  for (const resolver of resolvers) {
    const actor = await resolver({ headers, bearerToken });
    if (actor) return actor;
  }

  if (!bearerToken) {
    throw unauthorized("Missing bearer token or API key");
  }

  return resolveSessionActor(headers, authService);
}
