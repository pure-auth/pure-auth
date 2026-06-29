import type { OAuthProfile } from "./types";

export type PasswordHasher = {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
};

export type TokenPayload = {
  sub: string;
  sessionId: string;
};

export type TokenSigner = {
  sign(payload: TokenPayload, options: { expiresAt: Date }): Promise<string>;
  verify(token: string): Promise<TokenPayload>;
};

export type Mailer = {
  sendVerificationEmail(input: { email: string; token: string }): Promise<void>;
  sendOrganizationInvitationEmail?(input: {
    email: string;
    organizationName: string;
    token: string;
  }): Promise<void>;
};

export type OAuthVerifier = {
  verifyGoogleIdToken?(idToken: string): Promise<Omit<OAuthProfile, "provider">>;
};

export type AuthDependencies = {
  generateId(): string;
  now(): Date;
  password: PasswordHasher;
  tokens: TokenSigner;
  mailer?: Mailer;
  oauth?: OAuthVerifier;
};

export function createSystemClock(): Pick<AuthDependencies, "now"> {
  return {
    now: () => new Date(),
  };
}
