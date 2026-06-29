import {
  badRequest,
  conflict,
  forbidden,
  internal,
  unauthorized,
} from "@/errors";
import type { AuthDependencies } from "@/dependencies";
import type { TransactionalStorage } from "@/storage";
import type {
  AuthResponse,
  GoogleSignInInput,
  OAuthProviderInput,
  ResendVerificationInput,
  Session,
  SignInInput,
  SignUpInput,
  User,
} from "@/types";

export type AuthServiceConfig = {
  passwordProviderId: string;
  emailVerificationExpiresInMs: number;
  sessionExpiresInMs: number;
};

const defaultConfig: AuthServiceConfig = {
  passwordProviderId: "credential",
  emailVerificationExpiresInMs: 1000 * 60 * 60 * 24,
  sessionExpiresInMs: 1000 * 60 * 60 * 24 * 7,
};

export class AuthService<
  TStorage extends TransactionalStorage = TransactionalStorage,
> {
  private readonly config: AuthServiceConfig;

  constructor(
    private readonly storage: TStorage,
    private readonly dependencies: AuthDependencies,
    config: Partial<AuthServiceConfig> = {},
  ) {
    this.config = { ...defaultConfig, ...config };
  }

  async signUp(input: SignUpInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const existingUser = await this.storage.users.findByEmail(email);

    if (existingUser) {
      throw conflict("A user with this email already exists");
    }

    const passwordHash = await this.dependencies.password.hash(input.password);
    const verification = this.createVerificationToken();

    const user = await this.storage.transaction(async (tx) => {
      const createdUser = await tx.users.create({
        id: this.dependencies.generateId(),
        name: input.name,
        email,
        image: input.image ?? null,
        emailVerified: false,
      });

      await tx.accounts.create({
        id: this.dependencies.generateId(),
        accountId: email,
        providerId: this.config.passwordProviderId,
        userId: createdUser.id,
        password: passwordHash,
      });

      await tx.verifications.deleteByIdentifier(email);
      await tx.verifications.create({
        id: this.dependencies.generateId(),
        identifier: email,
        value: verification.token,
        expiresAt: verification.expiresAt,
      });

      return createdUser;
    });

    await this.dependencies.mailer?.sendVerificationEmail({
      email,
      token: verification.token,
    });

    return {
      user,
      session: verification,
    };
  }

  async signIn(input: SignInInput): Promise<AuthResponse> {
    const user = await this.findUserByEmail(input.email.toLowerCase());

    if (!user.emailVerified) {
      throw forbidden("Please verify your email before signing in");
    }

    const account = await this.storage.accounts.findByUserAndProvider({
      userId: user.id,
      providerId: this.config.passwordProviderId,
    });

    if (!account?.password) {
      throw unauthorized("Invalid email or password");
    }

    const passwordMatches = await this.dependencies.password.verify(
      input.password,
      account.password,
    );
    if (!passwordMatches) {
      throw unauthorized("Invalid email or password");
    }

    return this.createSession(user);
  }

  async verifyEmail(token: string): Promise<User> {
    const verification = await this.storage.verifications.findByValue(token);

    if (!verification || verification.expiresAt < this.dependencies.now()) {
      throw badRequest("Invalid or expired verification token");
    }

    const user = await this.storage.transaction(async (tx) => {
      const updatedUser = await tx.users
        .findByEmail(verification.identifier)
        .then((found) =>
          found
            ? tx.users.update(found.id, { emailVerified: true })
            : Promise.resolve(null),
        );

      await tx.verifications.deleteById(verification.id);
      return updatedUser;
    });

    if (!user) {
      throw unauthorized("User not found for verification token");
    }

    return user;
  }

  async resendVerification(
    input: ResendVerificationInput,
  ): Promise<{ emailVerificationSent: boolean }> {
    const email = input.email.toLowerCase();
    const user = await this.storage.users.findByEmail(email);

    if (!user || user.emailVerified) {
      return { emailVerificationSent: true };
    }

    const verification = this.createVerificationToken();

    await this.storage.transaction(async (tx) => {
      await tx.verifications.deleteByIdentifier(email);
      await tx.verifications.create({
        id: this.dependencies.generateId(),
        identifier: email,
        value: verification.token,
        expiresAt: verification.expiresAt,
      });
    });

    await this.dependencies.mailer?.sendVerificationEmail({
      email,
      token: verification.token,
    });

    return { emailVerificationSent: true };
  }

  async signInWithOAuth(input: OAuthProviderInput): Promise<AuthResponse> {
    const providerAccount = await this.storage.accounts.findByProviderAccount({
      providerId: input.provider,
      accountId: input.providerAccountId,
    });

    if (providerAccount) {
      await this.storage.accounts.update(providerAccount.id, {
        accessToken: input.accessToken ?? null,
        refreshToken: input.refreshToken ?? null,
        idToken: input.idToken ?? null,
        scope: input.scope ?? null,
      });

      const user = await this.storage.users.findById(providerAccount.userId);
      if (!user) {
        throw unauthorized("User for OAuth account was not found");
      }

      return this.createSession(user);
    }

    const user = await this.findOrCreateOAuthUser(input);
    await this.storage.accounts.create({
      id: this.dependencies.generateId(),
      accountId: input.providerAccountId,
      providerId: input.provider,
      userId: user.id,
      accessToken: input.accessToken ?? null,
      refreshToken: input.refreshToken ?? null,
      idToken: input.idToken ?? null,
      scope: input.scope ?? null,
    });

    return this.createSession(user);
  }

  async signInWithGoogle(input: GoogleSignInInput): Promise<AuthResponse> {
    const profile = await this.dependencies.oauth?.verifyGoogleIdToken?.(
      input.idToken,
    );

    if (!profile) {
      throw internal("Google login is not configured");
    }

    return this.signInWithOAuth({
      provider: "google",
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.name,
      image: profile.image,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      idToken: input.idToken,
      scope: input.scope,
    });
  }

  async verifySessionToken(
    token: string,
  ): Promise<{ user: User; session: Session }> {
    const payload = await this.dependencies.tokens.verify(token);
    const session = await this.storage.sessions.findByToken(token);

    if (!session || session.expiresAt < this.dependencies.now()) {
      throw unauthorized("Session expired");
    }

    if (session.id !== payload.sessionId || session.userId !== payload.sub) {
      throw unauthorized("Invalid session token");
    }

    const user = await this.storage.users.findById(payload.sub);
    if (!user) {
      throw unauthorized("Session user was not found");
    }

    return { user, session };
  }

  async signOut(token: string): Promise<void> {
    await this.storage.sessions.deleteByToken(token);
  }

  private async createSession(user: User): Promise<AuthResponse> {
    const sessionId = this.dependencies.generateId();
    const expiresAt = new Date(
      this.dependencies.now().getTime() + this.config.sessionExpiresInMs,
    );
    const token = await this.dependencies.tokens.sign(
      {
        sub: user.id,
        sessionId,
      },
      { expiresAt },
    );

    await this.storage.sessions.create({
      id: sessionId,
      token,
      expiresAt,
      userId: user.id,
      activeOrganizationId: null,
    });

    return {
      user,
      session: {
        token,
        expiresAt,
      },
    };
  }

  private async findUserByEmail(email: string): Promise<User> {
    const user = await this.storage.users.findByEmail(email);

    if (!user) {
      throw unauthorized("Invalid email or password");
    }

    return user;
  }

  private async findOrCreateOAuthUser(
    input: OAuthProviderInput,
  ): Promise<User> {
    const email = input.email.toLowerCase();
    const existingUser = await this.storage.users.findByEmail(email);

    if (existingUser) {
      if (!existingUser.emailVerified && input.emailVerified) {
        return (
          (await this.storage.users.update(existingUser.id, {
            emailVerified: true,
          })) ?? existingUser
        );
      }

      return existingUser;
    }

    return this.storage.users.create({
      id: this.dependencies.generateId(),
      name: input.name,
      email,
      image: input.image ?? null,
      emailVerified: input.emailVerified,
    });
  }

  private createVerificationToken(): { token: string; expiresAt: Date } {
    return {
      token: this.dependencies.generateId(),
      expiresAt: new Date(
        this.dependencies.now().getTime() +
          this.config.emailVerificationExpiresInMs,
      ),
    };
  }
}
