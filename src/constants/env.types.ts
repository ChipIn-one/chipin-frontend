import type { ENV_DEV, ENV_PRODUCTION } from './env';

export type Environment = typeof ENV_DEV | typeof ENV_PRODUCTION;
