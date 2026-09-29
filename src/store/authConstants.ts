const AUTH_STATUS = {
    UNKNOWN: 'unknown',
    AUTHENTICATED: 'authenticated',
    UNAUTHENTICATED: 'unauthenticated',
} as const;

type AuthStatus = (typeof AUTH_STATUS)[keyof typeof AUTH_STATUS];

const UNAUTH_REASON = {
    MISSING: 'missing',
    EXPIRED: 'expired',
    INVALID: 'invalid',
    SIGNED_OUT: 'signed_out',
    ERROR: 'error',
    PERSISTENCE_ERROR: 'persistence_error',
} as const;

type UnauthReason = (typeof UNAUTH_REASON)[keyof typeof UNAUTH_REASON];

export { AUTH_STATUS, UNAUTH_REASON };
export type { AuthStatus, UnauthReason };
