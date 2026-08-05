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
    settings?: ApiUserSettings;
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
    firstName: string | null;
    lastName: string | null;
    picture: string | null;
    role: ApiUserRole;
    subscriptionUntil: number | null;
    settings: ApiUserSettings;
    createdAt: number;
    updatedAt: number;
}

export interface ApiUserSummary {
    id: string;
    email: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    picture: string | null;
    createdAt: number;
    updatedAt: number;
}

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
    emoji: string | null;
    coverUrl: string | null;
    role: 'OWNER' | 'MEMBER';
    status: 'ACTIVE' | 'ARCHIVED';
    recentActivities: ApiActivityFeedItemResponse[];
}

export interface ApiGroupsResponse {
    items: ApiGroupResponse[];
    nextCursor: number | null;
}

export interface ApiRemoveGroupResponse {
    id: string;
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

export type ApiFriendUser = ApiUserSummary;

export interface ApiFriendBalance {
    currency: string;
    netAmount: number;
}

export interface ApiFriend {
    user: ApiFriendUser;
    balances: ApiFriendBalance[];
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
    description: string;
    amount: number;
    currency: string;
    date: number;
    payer: ApiUserResponse;
    groupId: string;
    participants: ApiUserResponse[];
    participantShares: ApiParticipantShare[];
    category: string;
    creator: ApiUserResponse;
    createdAt: number;
    updatedAt: number;
}

export interface ApiSettlementDetails {
    id: string;
    fromUser: ApiUserResponse;
    toUser: ApiUserResponse;
    amount: number;
    currency: string;
    settledAt: number;
    scope: string;
    groupId: string;
}

export interface ApiCreateLedgerResponse {
    id: string;
    type: 'EXPENSE' | 'SETTLEMENT';
    scope: string;
    groupId: string;
    expense: ApiExpenseDetails | null;
    settlement: ApiSettlementDetails | null;
    createdAt: number;
    updatedAt: number;
}

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
