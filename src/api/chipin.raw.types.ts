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

export interface ApiKnownUserBalanceEntry {
    currency: string;
    amount: number;
}

export interface ApiFriendResponse {
    user: ApiUserResponse;
    balances: BalancesMap;
}
