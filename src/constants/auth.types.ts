import type { AUTH_PROVIDERS } from './auth';

export type AuthService = (typeof AUTH_PROVIDERS)[keyof typeof AUTH_PROVIDERS];
