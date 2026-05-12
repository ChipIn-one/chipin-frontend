import type { BalancesMap } from 'helpers/currencies';

import type { ApiGroupResponse } from './chipin.raw.types';

// ─── Re-exports: raw response types (for api layer & helpers) ──────────────
export type {
    ApiActivityItemsResponse,
    ApiBalanceEntryResponse,
    ApiDashboardResponse,
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
export type { ApiUserResponse as User } from './chipin.raw.types';

/** Balance entry with Big.js fields, as parsed from raw API. */
export type { BalanceEntry, BalancesMap } from 'helpers/currencies';

/** Group with parsed Big.js balances — the shape used throughout the UI. */
export interface Group extends Omit<ApiGroupResponse, 'balances'> {
    balances: BalancesMap;
}

/** Dashboard response with parsed groups and balances. */
export type Dashboard = {
    groups: Group[];
    balances: BalancesMap;
};
