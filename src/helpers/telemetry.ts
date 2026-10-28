import {
    FRIEND_INVITE_ROUTE_PATTERN,
    GROUP_INVITE_API_PATTERN,
    GROUP_INVITE_ROUTE_PATTERN,
    USER_INVITE_API_PATTERN,
    VERCEL_DOMAIN_SUFFIX,
} from 'constants/telemetry';

export const resolveTelemetryEnvironment = (
    buildEnvironment: string,
    hostname: string,
): string => {
    if (hostname.endsWith(VERCEL_DOMAIN_SUFFIX)) {
        return 'development';
    }

    return buildEnvironment;
};

export const sanitizeTelemetryUrl = (url: string): string => {
    const [withoutHash] = url.split('#');
    const [withoutQuery] = withoutHash.split('?');

    return withoutQuery
        .replace(GROUP_INVITE_ROUTE_PATTERN, '/group/join/:inviteToken')
        .replace(FRIEND_INVITE_ROUTE_PATTERN, '/friends/join/:inviteToken')
        .replace(USER_INVITE_API_PATTERN, '/users/invite/:inviteToken')
        .replace(GROUP_INVITE_API_PATTERN, '/groups/invite/:inviteToken');
};

// Shallow pass over a telemetry record: every string value goes through sanitizeTelemetryUrl.
export const sanitizeStringValues = <T extends Record<string, unknown>>(values: T): T => {
    const sanitized = { ...values };

    for (const [key, value] of Object.entries(sanitized)) {
        if (typeof value === 'string') {
            Object.assign(sanitized, { [key]: sanitizeTelemetryUrl(value) });
        }
    }

    return sanitized;
};

interface TelemetryEventWithUrl {
    url: string;
    route?: string;
}

export const sanitizeTelemetryEvent = <T extends TelemetryEventWithUrl>(
    event: T,
): T => {
    return {
        ...event,
        url: sanitizeTelemetryUrl(event.url),
        ...(typeof event.route === 'string' && {
            route: sanitizeTelemetryUrl(event.route),
        }),
    };
};
