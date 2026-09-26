const INVITE_ROUTE_PATTERN = /\/group\/join\/[^/]+/;
const VERCEL_DOMAIN_SUFFIX = '.vercel.app';

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

    return withoutQuery.replace(
        INVITE_ROUTE_PATTERN,
        '/group/join/:inviteToken',
    );
};
