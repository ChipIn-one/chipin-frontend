import type { ENV_DEV, ENV_PROD } from './env';

export type Environment = typeof ENV_DEV | typeof ENV_PROD;
