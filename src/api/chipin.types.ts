import type {
    ApiFriendResponse,
    ApiGroupResponse,
    ApiUserResponse,
    BalancesMap,
} from './chipin.raw.types';

// ─── Re-exports: raw response types (for api layer & helpers) ──────────────
export type {
    ApiActivityItemsResponse,
    ApiDashboardResponse,
    ApiFriendResponse,
    ApiGroupResponse,
    ApiRemoveGroupResponse,
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

/** Known user — raw API shape. */
export type Friend = ApiFriendResponse;

/** Group — same shape as the API response. */
export type Group = ApiGroupResponse;

/** Dashboard response with parsed groups and balances. */
export type Dashboard = {
    groups: Group[];
    balances: BalancesMap;
};
