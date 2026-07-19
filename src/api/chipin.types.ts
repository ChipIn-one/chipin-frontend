import type {
    ApiActivityItemsResponse,
    ApiFriend,
    ApiFriendBalance,
    ApiFriendUser,
    ApiGroupResponse,
    ApiGroupUserResponse,
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
    ApiFriend,
    ApiFriendBalance,
    ApiFriendsResponse,
    ApiFriendUser,
    ApiGroupResponse,
    ApiLedgerEntryResponse,
    ApiOAuthTokenPairResponse,
    ApiParticipantShare,
    ApiRefreshTokenPairResponse,
    ApiRemoveGroupResponse,
    ApiSettlementDetails,
    ApiUpdateUserRequest,
    ApiUserResponse,
} from './chipin.raw.types';

// ─── Re-exports: call param types ─────────────────────────────────────────
export type {
    ActivityCategory,
    CreateGroupParams,
    CreateLedgerEntryParams,
    CreateSettlementParams,
    DeleteLedgerEntryParams,
    FetchActivityChildrenParams,
    FetchActivityParams,
    InviteToGroupParams,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
    RemoveKnownUserParams,
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
export type FriendUser = ApiFriendUser;
export type FriendBalance = ApiFriendBalance;
export type KnownUser = ApiFriend;

/** Group — same shape as the API response. */
export type Group = ApiGroupResponse;
export type GroupUser = ApiGroupUserResponse;

/** Dashboard response with parsed balances and activity. */
export type Dashboard = {
    balances: BalancesMap;
    activity: ApiActivityItemsResponse;
};
