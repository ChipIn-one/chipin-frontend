import {
    FRIEND_INVITE_ROUTE_PATTERN,
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
        .replace(USER_INVITE_API_PATTERN, '/users/invite/:inviteToken');
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
