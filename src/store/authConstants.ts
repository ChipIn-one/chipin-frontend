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

// Spec 03 §1.6: `offline-cached` is an offline cold start let through to the cached data without a
// refresh; the next successful refresh makes it `online`.
const SESSION_MODE = {
    ONLINE: 'online',
    OFFLINE_CACHED: 'offline-cached',
} as const;

type SessionMode = (typeof SESSION_MODE)[keyof typeof SESSION_MODE];

export { AUTH_STATUS, SESSION_MODE, UNAUTH_REASON };
export type { AuthStatus, SessionMode, UnauthReason };
