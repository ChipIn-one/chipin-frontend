export const MESSAGES = {
    error: {
        group: {
            INVITE_JOIN: 'Failed to join the group. Please check the invite link and try again.',
        },
        auth: {
            INVALID_JWT: 'Failed to validate session. Please log in again.',
            SESSION_EXPIRED: 'Session expired, please log in again.',
        },
    },
    success: {
        common: {
            reconnected: 'Your connection has been restored.',
        },
        group: {
            INVITE_JOIN: (groupName: string) => `You successfully joined the group ${groupName}!`,
        },
        pwa: {
            INSTALLING: 'Installing application on your home screen...',
        },
    },
    warning: {
        common: {
            disconnect: 'You have been disconnected.',
            disconnectDescription:
                "Don't worry, your changes will be saved. Attempting to reconnect...",
        },
        group: {
            INVITE_JOIN: 'Please sign in before joining the group.',
        },
    },
};
