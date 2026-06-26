import type {
    ApiGroupResponse,
    ApiSettledFriend,
    ApiUnsettledFriend,
    ApiUserResponse,
    BalancesMap,
} from './chipin.raw.types';

// ─── Re-exports: raw response types (for api layer & helpers) ──────────────
export type {
    ApiActivityItemsResponse,
    ApiCurrencyRatesResponse,
    ApiDashboardResponse,
    ApiExpenseDetails,
    ApiFriendsResponse,
    ApiGroupResponse,
    ApiLedgerEntryResponse,
    ApiOAuthTokenPairResponse,
    ApiParticipantShare,
    ApiRefreshTokenPairResponse,
    ApiRemoveGroupResponse,
    ApiSettledFriend,
    ApiSettlementDetails,
    ApiUnsettledFriend,
    ApiUserResponse,
} from './chipin.raw.types';

// ─── Re-exports: call param types ─────────────────────────────────────────
export type {
    CreateGroupParams,
    CreateLedgerEntryParams,
    FetchActivityParams,
    InviteToGroupParams,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
    SharingMode,
    SharingModeType,
    UpdateGroupParams,
} from './chipin.params';

// ─── Frontend types (used in components, store, hooks) ────────────────────

/** User as used on the frontend (no parsing needed — all fields are plain). */
export type User = ApiUserResponse;

/** A currency group within known users response. */
export type UnsettledFriends = ApiUnsettledFriend;

/** A settled friend with no outstanding balances. */
export type SettledFriend = ApiSettledFriend;

/** Group — same shape as the API response. */
export type Group = ApiGroupResponse;

/** Dashboard response with parsed groups and balances. */
export type Dashboard = {
    groups: Group[];
    balances: BalancesMap;
};
