const INVITE_ROUTE_PATTERN = /\/group\/join\/[^/]+/;

export const sanitizeTelemetryUrl = (url: string): string => {
    const [withoutHash] = url.split('#');
    const [withoutQuery] = withoutHash.split('?');

    return withoutQuery.replace(
        INVITE_ROUTE_PATTERN,
        '/group/join/:inviteToken',
    );
};
