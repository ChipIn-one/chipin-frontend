// Backend InviteTokenGenerator: base64url alphabet; DB column VARCHAR(64).
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export const isInviteToken = (value: string | undefined): value is string =>
    typeof value === 'string' && INVITE_TOKEN_PATTERN.test(value);
