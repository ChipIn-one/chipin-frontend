import type {
    ApiActivityItemsResponse,
    ApiGroupResponse,
    ApiSettledFriend,
    ApiUnsettledFriend,
    ApiUserResponse,
    ApiUserRole,
    ApiUserSettings,
    ApiUserTheme,
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
    ApiUpdateUserRequest,
    ApiUserResponse,
} from './chipin.raw.types';

// ─── Re-exports: call param types ─────────────────────────────────────────
export type {
    ActivityCategory,
    CreateGroupParams,
    CreateLedgerEntryParams,
    DeleteLedgerEntryParams,
    FetchActivityChildrenParams,
    FetchActivityParams,
    InviteToGroupParams,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
    SharingMode,
    SharingModeType,
    UpdateGroupParams,
    UpdateUserParams,
} from './chipin.params';

// ─── Frontend types (used in components, store, hooks) ────────────────────

/** User as used on the frontend (no parsing needed — all fields are plain). */
export type User = ApiUserResponse;
export type UserSettings = ApiUserSettings;
export type UserRole = ApiUserRole;
export type ThemeName = ApiUserTheme;
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
    activity: ApiActivityItemsResponse;
};
