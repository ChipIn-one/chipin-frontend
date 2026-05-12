import { AppEvent } from './activity.types';

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

export interface ApiBalanceEntryResponse {
    currency: string;
    totalOwed: string;
    totalOwing: string;
    netBalance: string;
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
    balances?: Record<string, ApiBalanceEntryResponse>;
}

export interface ApiRemoveGroupResponse {
    id: string;
}

export interface ApiDashboardResponse {
    groups: ApiGroupResponse[];
    balances?: Record<string, ApiBalanceEntryResponse>;
}

export interface ApiActivityItemsResponse {
    items: AppEvent[];
    nextCursor: string | null;
}
