import type {
    ApiActivityFeedItemResponse,
    ApiDashboardResponse,
    ApiFriend,
    ApiFriendBalance,
    ApiGroupResponse,
    ApiSelfUserResponse,
    ApiUserResponse,
    ApiUserRole,
    ApiUserSettings,
    ApiUserSex,
    ApiUserSummary,
    ApiUserTheme,
} from './chipin.raw.types';

// ─── Re-exports: raw response types (for api layer & helpers) ──────────────
export type {
    ApiActivityChildrenResponse,
    ApiActivityFeedItemResponse,
    ApiActivityFeedResponse,
    ApiActivityItemsResponse,
    ApiCreateLedgerResponse,
    ApiCurrencyRatesResponse,
    ApiDashboardResponse,
    ApiExpenseDetails,
    ApiFriend,
    ApiFriendBalance,
    ApiFriendsResponse,
    ApiGroupResponse,
    ApiGroupsResponse,
    ApiOAuthTokenPairResponse,
    ApiParticipantShare,
    ApiRefreshTokenPairResponse,
    ApiSelfUserResponse,
    ApiSettlementDetails,
    ApiUpdateUserRequest,
    ApiUserResponse,
} from './chipin.raw.types';

// ─── Re-exports: call param types ─────────────────────────────────────────
export type {
    CreateGroupParams,
    CreateLedgerEntryParams,
    CreateSettlementParams,
    FetchActivitiesParams,
    FetchActivityChildrenParams,
    InviteToGroupParams,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
    RemoveKnownUserParams,
    RemoveLedgerEntryParams,
    SharingMode,
    SharingModeType,
    UpdateGroupParams,
    UpdateLedgerEntryParams,
    UpdateUserParams,
    UploadGroupCoverParams,
    UploadUserAvatarParams,
} from './chipin.params';

// ─── Frontend types (used in components, store, hooks) ────────────────────

/** Public user embedded in friend, group, ledger, and activity contracts. */
export type User = ApiUserResponse;
/** Authenticated user returned from `/users/self`. */
export type SelfUser = ApiSelfUserResponse;
export type UserSettings = ApiUserSettings;
export type UserRole = ApiUserRole;
export type UserSex = ApiUserSex;
export type ThemeName = ApiUserTheme;
export type UserSummary = ApiUserSummary;
export type FriendUser = UserSummary;
export type FriendBalance = ApiFriendBalance;
export type KnownUser = ApiFriend;

export type Group = ApiGroupResponse;
export type GroupUser = UserSummary;

export type ActivityFeedItem = ApiActivityFeedItemResponse;
export type Dashboard = ApiDashboardResponse;
