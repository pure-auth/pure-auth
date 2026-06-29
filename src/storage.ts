import type { Account, Session, User, Verification } from "./types";

export type CreateUserInput = Omit<User, "createdAt" | "updatedAt">;
export type UpdateUserInput = Partial<
  Pick<User, "name" | "email" | "emailVerified" | "image">
>;

export type CreateAccountInput = Omit<Account, "createdAt" | "updatedAt">;
export type UpdateAccountInput = Partial<
  Pick<
    Account,
    | "accessToken"
    | "refreshToken"
    | "idToken"
    | "accessTokenExpiresAt"
    | "refreshTokenExpiresAt"
    | "scope"
    | "password"
  >
>;

export type CreateSessionInput = Omit<Session, "createdAt" | "updatedAt">;
export type UpdateSessionInput = Partial<
  Pick<Session, "activeOrganizationId" | "expiresAt" | "ipAddress" | "userAgent">
>;

export type CreateVerificationInput = Omit<
  Verification,
  "createdAt" | "updatedAt"
>;

export type UserRepository = {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, input: UpdateUserInput): Promise<User | null>;
  delete(id: string): Promise<User | null>;
};

export type AccountRepository = {
  findByProviderAccount(input: {
    providerId: string;
    accountId: string;
  }): Promise<Account | null>;
  findByUserAndProvider(input: {
    userId: string;
    providerId: string;
  }): Promise<Account | null>;
  create(input: CreateAccountInput): Promise<Account>;
  update(id: string, input: UpdateAccountInput): Promise<Account | null>;
};

export type SessionRepository = {
  findByToken(token: string): Promise<Session | null>;
  create(input: CreateSessionInput): Promise<Session>;
  update(id: string, input: UpdateSessionInput): Promise<Session | null>;
  deleteByToken(token: string): Promise<void>;
};

export type VerificationRepository = {
  findByValue(value: string): Promise<Verification | null>;
  deleteByIdentifier(identifier: string): Promise<void>;
  deleteById(id: string): Promise<void>;
  create(input: CreateVerificationInput): Promise<Verification>;
};

export type CoreStorage = {
  users: UserRepository;
  accounts: AccountRepository;
  sessions: SessionRepository;
  verifications: VerificationRepository;
};

export type TransactionalStorage<TStorage extends CoreStorage = CoreStorage> =
  TStorage & {
    transaction<TResult>(handler: (storage: TStorage) => Promise<TResult>): Promise<TResult>;
  };
