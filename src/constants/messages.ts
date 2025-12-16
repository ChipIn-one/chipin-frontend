export const MESSAGES = {
    error: {
        group: {
            INVITE_SUCCESS: 'Failed to join the group. Please check the invite link and try again.',
        },
        auth: {
            INVALID_JWT: 'Failed to validate session. Please log in again.',
            SESSION_EXPIRED: 'Session expired, please log in again.',
        },
    },
    success: {
        group: {
            INVITE_SUCCESS: 'You successfully joined the group!',
        },
        pwa: {
            INSTALLING: 'Installing application on your home screen...',
        },
    },
    warning: {
        auth: {
            MUST_BE_LOGGED_IN: 'You must be logged in to access this page',
        },
    },
};
