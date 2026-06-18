import { AppEvent } from './activity.types';

export interface BalanceEntry {
    currency: string;
    netBalance: number;
}

export type BalancesMap = Record<string, BalanceEntry>;

export type CurrenciesRates = Record<string, number>;

export interface ApiUserResponse {
    id: string;
    email: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    picture: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface ApiGroupResponse {
    id: string;
    name: string;
    description: string | null;
    emoji: string | null;
    coverUrl: string | null;
    createdAt: number;
    updatedAt: number;
    // TODO TO BASE API USER
    inviteToken: string;
    creator: ApiUserResponse;
    members: ApiUserResponse[];
    role: 'OWNER' | 'MEMBER';
    status: 'ACTIVE' | 'ARCHIVED';
    balances: BalancesMap;
}

export interface ApiRemoveGroupResponse {
    id: string;
}

export interface ApiDashboardResponse {
    groups: ApiGroupResponse[];
    balances: BalancesMap;
}

export interface ApiActivityItemsResponse {
    items: AppEvent[];
    nextCursor: number | null;
}

export interface ApiFriendInCurrency {
    user: ApiUserResponse;
    amount: number;
}

export interface ApiUnsettledFriend {
    currency: string;
    netBalance: number;
    friends: ApiFriendInCurrency[];
}

export interface ApiSettledFriend {
    user: ApiUserResponse;
}

export interface ApiFriendsResponse {
    currencies: ApiUnsettledFriend[];
    settledFriends: ApiSettledFriend[];
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

export interface ApiLedgerEntryResponse {
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
