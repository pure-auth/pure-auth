import type { Account, Session, User, Verification } from "@/types";
import type {
  TransactionalStorage,
  CreateAccountInput,
  CreateSessionInput,
  CreateUserInput,
  CreateVerificationInput,
  UpdateAccountInput,
  UpdateSessionInput,
  UpdateUserInput,
} from "@/storage";

export type MemoryAuthData = {
  users: User[];
  accounts: Account[];
  sessions: Session[];
  verifications: Verification[];
};

export function createMemoryAuthStorage(
  seed: Partial<MemoryAuthData> = {},
): TransactionalStorage {
  const data: MemoryAuthData = {
    users: [...(seed.users ?? [])],
    accounts: [...(seed.accounts ?? [])],
    sessions: [...(seed.sessions ?? [])],
    verifications: [...(seed.verifications ?? [])],
  };

  const storage: TransactionalStorage = {
    users: {
      async findById(id) {
        return data.users.find((user) => user.id === id) ?? null;
      },
      async findByEmail(email) {
        return data.users.find((user) => user.email === email) ?? null;
      },
      async create(input: CreateUserInput) {
        const user = withTimestamps(input);
        data.users.push(user);
        return user;
      },
      async update(id: string, input: UpdateUserInput) {
        const user = data.users.find((item) => item.id === id);
        if (!user) return null;
        Object.assign(user, input, { updatedAt: new Date() });
        return user;
      },
      async delete(id: string) {
        const index = data.users.findIndex((user) => user.id === id);
        if (index === -1) return null;
        return data.users.splice(index, 1)[0] ?? null;
      },
    },
    accounts: {
      async findByProviderAccount(input) {
        return (
          data.accounts.find(
            (account) =>
              account.providerId === input.providerId &&
              account.accountId === input.accountId,
          ) ?? null
        );
      },
      async findByUserAndProvider(input) {
        return (
          data.accounts.find(
            (account) =>
              account.userId === input.userId &&
              account.providerId === input.providerId,
          ) ?? null
        );
      },
      async create(input: CreateAccountInput) {
        const account = withTimestamps(input);
        data.accounts.push(account);
        return account;
      },
      async update(id: string, input: UpdateAccountInput) {
        const account = data.accounts.find((item) => item.id === id);
        if (!account) return null;
        Object.assign(account, input, { updatedAt: new Date() });
        return account;
      },
    },
    sessions: {
      async findByToken(token) {
        return data.sessions.find((session) => session.token === token) ?? null;
      },
      async create(input: CreateSessionInput) {
        const session = withTimestamps(input);
        data.sessions.push(session);
        return session;
      },
      async update(id: string, input: UpdateSessionInput) {
        const session = data.sessions.find((item) => item.id === id);
        if (!session) return null;
        Object.assign(session, input, { updatedAt: new Date() });
        return session;
      },
      async deleteByToken(token) {
        const index = data.sessions.findIndex(
          (session) => session.token === token,
        );
        if (index !== -1) {
          data.sessions.splice(index, 1);
        }
      },
    },
    verifications: {
      async findByValue(value) {
        return (
          data.verifications.find(
            (verification) => verification.value === value,
          ) ?? null
        );
      },
      async deleteByIdentifier(identifier) {
        data.verifications = data.verifications.filter(
          (verification) => verification.identifier !== identifier,
        );
      },
      async deleteById(id) {
        data.verifications = data.verifications.filter(
          (verification) => verification.id !== id,
        );
      },
      async create(input: CreateVerificationInput) {
        const verification = withTimestamps(input);
        data.verifications.push(verification);
        return verification;
      },
    },
    async transaction(handler) {
      return handler(storage);
    },
  };

  return storage;
}

function withTimestamps<T extends object>(
  input: T,
): T & {
  createdAt: Date;
  updatedAt: Date;
} {
  const now = new Date();
  return {
    ...input,
    createdAt: now,
    updatedAt: now,
  };
}
