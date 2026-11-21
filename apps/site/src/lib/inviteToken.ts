// The invite token format (spec 04 §3.5, KB USR-006, GRP-037). A domain constant copied from the
// app (`apps/app/src/helpers/inviteToken.ts`): inviteToken.test.ts fails when the two differ.
const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** The app path prefix of each invite kind; the token follows, URI-encoded (spec 04 §3.5). */
const INVITE_APP_PATHS = {
    group: '/group/join/',
    friend: '/friends/join/',
} as const;

type InviteKind = keyof typeof INVITE_APP_PATHS;

const INVITE_KINDS = Object.keys(INVITE_APP_PATHS) as InviteKind[];

export { INVITE_APP_PATHS, INVITE_KINDS, INVITE_TOKEN_PATTERN };
export type { InviteKind };
