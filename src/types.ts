export type AuthId = string;

export type User = {
  id: AuthId;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Session = {
  id: AuthId;
  token: string;
  expiresAt: Date;
  userId: AuthId;
  activeOrganizationId?: AuthId | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Account = {
  id: AuthId;
  accountId: string;
  providerId: string;
  userId: AuthId;
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
  accessTokenExpiresAt?: Date | null;
  refreshTokenExpiresAt?: Date | null;
  scope?: string | null;
  password?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Verification = {
  id: AuthId;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type AuthSession = {
  token: string;
  expiresAt: Date;
};

export type AuthResponse = {
  user: User;
  session: AuthSession;
};

export type SessionActor = {
  type: "user";
  user: User;
  session: Session;
};

export type AuthenticatedActor = SessionActor | PluginActor;

export type PluginActor = {
  type: string;
  [key: string]: unknown;
};

export type AuthContext = {
  user: User;
  session: Session;
  actor: SessionActor;
};

export type ServiceContext = {
  userId: AuthId;
  sessionId?: AuthId;
  actor?: AuthenticatedActor;
};

export type ListOptions<
  TOrderBy extends string,
  TFilter extends Record<string, unknown> = Record<string, never>,
> = {
  limit: number;
  offset: number;
  orderBy: TOrderBy;
  orderDirection: "asc" | "desc";
  filter?: TFilter;
};

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
  image?: string | null;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type ResendVerificationInput = {
  email: string;
};

export type OAuthProviderInput = {
  provider: string;
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
  scope?: string | null;
};

export type GoogleSignInInput = {
  idToken: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  scope?: string | null;
};

export type OAuthProfile = {
  provider: string;
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
};
