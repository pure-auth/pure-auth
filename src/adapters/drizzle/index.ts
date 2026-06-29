import type {
  CreateAccountInput,
  CreateSessionInput,
  CreateUserInput,
  CreateVerificationInput,
  TransactionalStorage,
  UpdateAccountInput,
  UpdateSessionInput,
  UpdateUserInput,
} from "@/storage";
import type { Account, Session, User, Verification } from "@/types";

type DrizzleDatabase = {
  query: Record<string, {
    findFirst(input: unknown): Promise<unknown>;
  }>;
  insert(table: unknown): {
    values(input: unknown): {
      returning(): Promise<unknown[]>;
    };
  };
  update(table: unknown): {
    set(input: unknown): {
      where(input: unknown): {
        returning(): Promise<unknown[]>;
      };
    };
  };
  delete(table: unknown): {
    where(input: unknown): Promise<unknown> | {
      returning(): Promise<unknown[]>;
    };
  };
  transaction<TResult>(
    handler: (tx: DrizzleDatabase) => Promise<TResult>,
  ): Promise<TResult>;
};

type DrizzleSchema = Record<string, unknown>;

type WhereOperators = {
  eq(left: unknown, right: unknown): unknown;
  and(...conditions: unknown[]): unknown;
};

export type DrizzleAuthAdapterOptions<TDatabase extends DrizzleDatabase> = {
  db: TDatabase;
  schema: DrizzleSchema;
  operators: Pick<WhereOperators, "eq">;
};

export function createDrizzleAuthAdapter<TDatabase extends DrizzleDatabase>(
  options: DrizzleAuthAdapterOptions<TDatabase>,
): TransactionalStorage {
  return createStorage(options.db, options.schema, options.operators);
}

function createStorage(
  db: DrizzleDatabase,
  schema: DrizzleSchema,
  operators: Pick<WhereOperators, "eq">,
): TransactionalStorage {
  return {
    users: {
      async findById(id) {
        return (
          (await query(db, "user").findFirst({
            where: (table: Record<string, unknown>, { eq }: WhereOperators) =>
              eq(table.id, id),
          })) as User | null
        );
      },
      async findByEmail(email) {
        return (
          (await query(db, "user").findFirst({
            where: (table: Record<string, unknown>, { eq }: WhereOperators) =>
              eq(table.email, email),
          })) as User | null
        );
      },
      async create(input: CreateUserInput) {
        return first<User>(await db.insert(schema.user).values(input).returning());
      },
      async update(id: string, input: UpdateUserInput) {
        return firstOrNull<User>(
          await db
            .update(schema.user)
            .set(input)
            .where(whereEq("id", id, schema.user, operators))
            .returning(),
        );
      },
      async delete(id: string) {
        return firstOrNull<User>(
          await returningDelete(
            db.delete(schema.user).where(whereEq("id", id, schema.user, operators)),
          ),
        );
      },
    },
    accounts: {
      async findByProviderAccount(input) {
        return (
          (await query(db, "account").findFirst({
            where: (
              table: Record<string, unknown>,
              { and, eq }: WhereOperators,
            ) =>
              and(
                eq(table.providerId, input.providerId),
                eq(table.accountId, input.accountId),
              ),
          })) as Account | null
        );
      },
      async findByUserAndProvider(input) {
        return (
          (await query(db, "account").findFirst({
            where: (
              table: Record<string, unknown>,
              { and, eq }: WhereOperators,
            ) =>
              and(
                eq(table.userId, input.userId),
                eq(table.providerId, input.providerId),
              ),
          })) as Account | null
        );
      },
      async create(input: CreateAccountInput) {
        return first<Account>(
          await db.insert(schema.account).values(input).returning(),
        );
      },
      async update(id: string, input: UpdateAccountInput) {
        return firstOrNull<Account>(
          await db
            .update(schema.account)
            .set(input)
            .where(whereEq("id", id, schema.account, operators))
            .returning(),
        );
      },
    },
    sessions: {
      async findByToken(token) {
        return (
          (await query(db, "session").findFirst({
            where: (table: Record<string, unknown>, { eq }: WhereOperators) =>
              eq(table.token, token),
          })) as Session | null
        );
      },
      async create(input: CreateSessionInput) {
        return first<Session>(
          await db.insert(schema.session).values(input).returning(),
        );
      },
      async update(id: string, input: UpdateSessionInput) {
        return firstOrNull<Session>(
          await db
            .update(schema.session)
            .set(input)
            .where(whereEq("id", id, schema.session, operators))
            .returning(),
        );
      },
      async deleteByToken(token) {
        await db
          .delete(schema.session)
          .where(whereEq("token", token, schema.session, operators));
      },
    },
    verifications: {
      async findByValue(value) {
        return (
          (await query(db, "verification").findFirst({
            where: (table: Record<string, unknown>, { eq }: WhereOperators) =>
              eq(table.value, value),
          })) as Verification | null
        );
      },
      async deleteByIdentifier(identifier) {
        await db
          .delete(schema.verification)
          .where(whereEq("identifier", identifier, schema.verification, operators));
      },
      async deleteById(id) {
        await db
          .delete(schema.verification)
          .where(whereEq("id", id, schema.verification, operators));
      },
      async create(input: CreateVerificationInput) {
        return first<Verification>(
          await db.insert(schema.verification).values(input).returning(),
        );
      },
    },
    async transaction(handler) {
      return db.transaction((tx) => handler(createStorage(tx, schema, operators)));
    },
  };
}

function query(
  db: DrizzleDatabase,
  name: string,
): {
  findFirst(input: unknown): Promise<unknown>;
} {
  const tableQuery = db.query[name];
  if (!tableQuery) {
    throw new Error(`Drizzle adapter missing query.${name}`);
  }

  return tableQuery;
}

function whereEq(
  column: string,
  value: unknown,
  table: unknown,
  operators: Pick<WhereOperators, "eq">,
): unknown {
  return operators.eq((table as Record<string, unknown>)[column], value);
}

async function returningDelete(result: Promise<unknown> | {
  returning(): Promise<unknown[]>;
}): Promise<unknown[]> {
  if ("returning" in result) {
    return result.returning();
  }

  await result;
  return [];
}

function first<T>(items: unknown[]): T {
  const item = items[0] as T | undefined;
  if (!item) {
    throw new Error("Drizzle adapter expected a returned row");
  }

  return item;
}

function firstOrNull<T>(items: unknown[]): T | null {
  return (items[0] as T | undefined) ?? null;
}
