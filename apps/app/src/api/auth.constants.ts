const AUTH_API_PATH = {
    GOOGLE_OAUTH_EXCHANGE: '/auth/oauth/google/exchange',
    LOGOUT: '/auth/logout',
    LOGOUT_OTHER_DEVICES: '/auth/logout-other-devices',
    REFRESH: '/auth/refresh',
} as const;

const AUTH_CSRF_HEADERS = {
    'X-Chipin-Csrf': '1',
} as const;

export { AUTH_API_PATH, AUTH_CSRF_HEADERS };
