import type { AuthDependencies } from "./dependencies";
import type { TransactionalStorage } from "./storage";

export type AuthPluginContext<TStorage extends TransactionalStorage> = {
  storage: TStorage;
  dependencies: AuthDependencies;
};

export type AuthPlugin<
  TStorage extends TransactionalStorage = TransactionalStorage,
  TServices extends Record<string, unknown> = Record<string, unknown>,
> = {
  name: string;
  dependencies?: string[];
  init(context: AuthPluginContext<TStorage>): TServices;
};

export type InferPluginServices<TPlugin> =
  TPlugin extends AuthPlugin<TransactionalStorage, infer TServices>
    ? TServices
    : never;

export function createPlugin<
  TStorage extends TransactionalStorage,
  TServices extends Record<string, unknown>,
>(plugin: AuthPlugin<TStorage, TServices>): AuthPlugin<TStorage, TServices> {
  return plugin;
}
