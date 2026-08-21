import type { AppEvent } from './activity.types';

export interface BalanceEntry {
    currency: string;
    netBalance: number;
}

export type BalancesMap = Record<string, BalanceEntry>;

export type CurrenciesRates = Record<string, number>;

export type ApiUserRole = 'USER' | 'ADMIN';
export type ApiUserTheme = 'light' | 'dark' | 'system';
export type ApiUserSex = 'male' | 'female';

export interface ApiUserSettings {
    defaultCurrency: string;
    defaultCategory: string;
    timeFormat: '12h' | '24h';
    language: string;
    theme: ApiUserTheme;
    simplifyDebts: boolean;
    skipCategory: boolean;
    soloModeByDefault: boolean;
    saveGroupExpensesToSolo: boolean;
    sex: ApiUserSex;
}

export interface ApiUpdateUserRequest {
    displayName?: string;
    settings?: Partial<ApiUserSettings>;
}

export interface ApiCurrencyRatesResponse {
    base: string;
    timestamp: number;
    fetchedAt: number;
    stale: boolean;
    rates: CurrenciesRates;
}

export interface ApiUserResponse {
    id: string;
    email: string;
    displayName: string;
    firstName?: string | null;
    lastName?: string | null;
    picture?: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface ApiSelfUserResponse {
    id: string;
    email: string;
    displayName: string;
    picture?: string | null;
    role: ApiUserRole;
    subscriptionUntil: number | null;
    inviteToken: string;
    settings: ApiUserSettings;
    createdAt: number;
    updatedAt: number;
}

export type ApiUserSummary = ApiUserResponse;

export type ApiGroupUserResponse = ApiUserSummary;

export interface ApiGroupMemberResponse {
    user: ApiGroupUserResponse;
    balancesByCurrency: BalancesMap;
}

export interface ApiGroupResponse {
    id: string;
    name: string;
    inviteToken: string;
    description: string | null;
    creator: ApiGroupUserResponse;
    members: ApiGroupMemberResponse[];
    createdAt: number;
    updatedAt: number;
    coverUrl: string | null;
    simplifyDebts: boolean;
    role: 'OWNER' | 'MEMBER';
    status: 'ACTIVE';
    lastUsedCurrency: string | null;
    recentActivities: ApiActivityFeedResponse;
}

export interface ApiGroupsResponse {
    items: ApiGroupResponse[];
    nextCursor: string | null;
}

export interface ApiDashboardResponse {
    balances: BalancesMap;
    activity: ApiActivityFeedResponse;
}

export interface ApiActivityFeedItemResponse {
    parent: AppEvent;
    lastEvent: AppEvent;
}

export interface ApiActivityFeedResponse {
    items: ApiActivityFeedItemResponse[];
    nextCursor: number | null;
}

export interface ApiActivityItemsResponse {
    items: AppEvent[];
    nextCursor: number | null;
}

export interface ApiActivityChildrenResponse {
    parent: AppEvent;
    items: AppEvent[];
    nextCursor: number | null;
}

export type ApiFriendUser = ApiUserSummary;

export interface ApiFriendBalance {
    currency: string;
    netAmount: number;
}

export interface ApiFriend {
    user: ApiFriendUser;
    balances: ApiFriendBalance[];
    lastUsedCurrency: string | null;
}

export interface ApiFriendsResponse {
    friends: ApiFriend[];
}

export interface ApiParticipantShare {
    userId: string;
    shareAmount: number;
    currency: string;
}

export interface ApiExpenseDetails {
    id: string;
    description?: string | null;
    amount: number;
    currency: string;
    date: number;
    payer: ApiUserResponse;
    groupId?: string | null;
    participants: ApiUserResponse[];
    participantShares: ApiParticipantShare[];
    category?: string | null;
    subcategory?: string | null;
    creator: ApiUserResponse;
    systemAction?: ApiLedgerSystemAction;
    createdAt: number;
    updatedAt: number;
}

export type ApiLedgerScope = 'USER' | 'GROUP';
export type ApiLedgerSystemAction =
    | 'EXPENSE_TRANSFERRED_TO'
    | 'EXPENSE_TRANSFERRED_FROM'
    | null;

export interface ApiSettlementDetails {
    id: string;
    fromUser: ApiUserResponse;
    toUser: ApiUserResponse;
    amount: number;
    currency: string;
    settledAt: number;
    scope: ApiLedgerScope;
    groupId?: string | null;
    systemAction?: ApiLedgerSystemAction;
}

interface ApiLedgerEntryBase {
    id: string;
    scope: ApiLedgerScope;
    groupId?: string | null;
    systemAction?: ApiLedgerSystemAction;
    createdAt: number;
    updatedAt: number;
}

export interface ApiExpenseLedgerEntry extends ApiLedgerEntryBase {
    type: 'EXPENSE';
    expense: ApiExpenseDetails;
    settlement: null;
}

export interface ApiSettlementLedgerEntry extends ApiLedgerEntryBase {
    type: 'SETTLEMENT';
    expense: null;
    settlement: ApiSettlementDetails;
}

export type ApiCreateLedgerResponse = ApiExpenseLedgerEntry | ApiSettlementLedgerEntry;

export interface ApiOAuthTokenPairResponse {
    token: string;
    refresh_token: string;
    is_new_user: boolean;
}

export interface ApiRefreshTokenPairResponse {
    token: string;
    refresh_token: string;
}

export interface ApiLogoutOtherDevicesResponse {
    token: string;
    refresh_token: string;
}
