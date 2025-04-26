export const log = (...args: unknown[]): void => {
  // eslint-disable-next-line no-console -- logger
  console.log("LOGGER: ", ...args);
};

export * from './token-cache-client';

export type { TokenCacheData } from './token-cache-client';
