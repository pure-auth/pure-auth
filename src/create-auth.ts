import type { AuthDependencies } from "./dependencies";
import type { AuthPlugin } from "./plugin";
import type { ActorResolver, HeadersLike } from "./request";
import { resolveActor, resolveSessionActor } from "./request";
import { AuthService, type AuthServiceConfig } from "./services/auth-service";
import type { TransactionalStorage } from "./storage";

export type AuthInstance<
  TStorage extends TransactionalStorage = TransactionalStorage,
  TPluginServices extends Record<string, unknown> = Record<string, unknown>,
> = {
  services: {
    auth: AuthService<TStorage>;
  } & TPluginServices;
  resolveSession(headers: HeadersLike): ReturnType<typeof resolveSessionActor>;
  resolveActor(headers: HeadersLike): ReturnType<typeof resolveActor>;
};

export type CreateAuthOptions<
  TStorage extends TransactionalStorage,
  TPluginServices extends Record<string, unknown>,
> = {
  storage: TStorage;
  dependencies: AuthDependencies;
  auth?: Partial<AuthServiceConfig>;
  plugins?: AuthPlugin<TStorage, Record<string, unknown>>[];
  actorResolvers?: ActorResolver[];
  services?: TPluginServices;
};

export function createAuth<
  TStorage extends TransactionalStorage,
  TPluginServices extends Record<string, unknown> = Record<string, never>,
>(
  options: CreateAuthOptions<TStorage, TPluginServices>,
): AuthInstance<TStorage, TPluginServices> {
  const auth = new AuthService(options.storage, options.dependencies, options.auth);
  const services: Record<string, unknown> = {
    auth,
    ...(options.services ?? {}),
  };
  const actorResolvers = [...(options.actorResolvers ?? [])];

  for (const plugin of options.plugins ?? []) {
    const pluginServices = plugin.init({
      storage: options.storage,
      dependencies: options.dependencies,
    });
    Object.assign(services, pluginServices);

    const resolver = pluginServices.actorResolver;
    if (typeof resolver === "function") {
      actorResolvers.push(resolver as ActorResolver);
    }
  }

  return {
    services: services as AuthInstance<TStorage, TPluginServices>["services"],
    resolveSession: (headers) => resolveSessionActor(headers, auth),
    resolveActor: (headers) => resolveActor(headers, auth, actorResolvers),
  };
}
