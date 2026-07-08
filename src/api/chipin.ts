import type { AuthTokens } from 'helpers/localStorage';

import { apiInstance } from './chipin.instance';
import type { ApiFriendsResponse } from './chipin.raw.types';
import type {
    ApiActivityItemsResponse,
    ApiCurrencyRatesResponse,
    ApiLedgerEntryResponse,
    ApiOAuthTokenPairResponse,
    ApiRefreshTokenPairResponse,
    ApiRemoveGroupResponse,
    ApiUserResponse,
    CreateGroupParams,
    CreateLedgerEntryParams,
    CreateSettlementParams,
    Dashboard,
    FetchActivityParams,
    Group,
    InviteToGroupParams,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
    SharingMode,
    UpdateGroupParams,
    UpdateUserParams,
} from './chipin.types';

// =============== GROUPS AND USERS ===============

export const refreshApiAuthTokens = (
    refreshToken: string,
): Promise<ApiRefreshTokenPairResponse> => {
    return apiInstance
        .post('/auth/refresh', undefined, {
            headers: {
                'X-Refresh-Token': refreshToken,
            },
        })
        .then(response => response.data);
};

export const logoutApiAuthTokens = ({ accessToken, refreshToken }: AuthTokens): Promise<void> => {
    return apiInstance
        .post('/auth/logout', undefined, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-Refresh-Token': refreshToken,
            },
        })
        .then(() => undefined);
};

export const exchangeApiGoogleOAuthCode = async (
    code: string,
): Promise<ApiOAuthTokenPairResponse> => {
    const response = await apiInstance.post('/auth/oauth/google/exchange', { code });

    return response.data;
};

export const fetchApiUserGroups = (): Promise<Group[]> => {
    return apiInstance.get(`/groups`).then(result => result.data);
};

export const fetchApiUserGroupById = (groupId: string): Promise<Group> => {
    return apiInstance.get(`/groups/${groupId}`).then(result => result.data);
};

export const createApiGroup = async ({
    groupName,
    groupDescription,
    groupEmoji,
}: CreateGroupParams): Promise<Group> => {
    const response = await apiInstance.post('/groups', {
        name: groupName,
        ...(groupEmoji && { emoji: groupEmoji }),
        ...(groupDescription && { description: groupDescription }),
    });

    return response.data;
};

export const updateApiGroup = async ({
    groupId,
    groupName,
    groupDescription,
    groupEmoji,
}: UpdateGroupParams): Promise<Group> => {
    const response = await apiInstance.patch(`/groups/${groupId}`, {
        name: groupName,
        ...(groupEmoji && { emoji: groupEmoji }),
        ...(groupDescription && { description: groupDescription }),
    });

    return response.data;
};

export const removeApiGroup = async ({
    groupId,
}: RemoveGroupParams): Promise<ApiRemoveGroupResponse> => {
    const response = await apiInstance.delete(`/groups/${groupId}`);

    return response.data;
};

export const leaveApiGroup = async ({ groupId, newOwnerId }: LeaveGroupParams): Promise<void> => {
    await apiInstance.post(`/groups/${groupId}/leave`, {
        ...(newOwnerId && { newOwnerId }),
    });
};

export const kickApiGroupMember = async ({
    groupId,
    userId,
}: KickGroupMemberParams): Promise<void> => {
    await apiInstance.post(`/groups/${groupId}/members/${userId}/kick`);
};

export const inviteApiUserToGroup = async ({
    inviteToken,
}: InviteToGroupParams): Promise<Group> => {
    const response = await apiInstance.post(`/groups/invite/${inviteToken}`);

    return response.data;
};

export const fetchApiDashboard = (): Promise<Dashboard> => {
    return apiInstance.get(`/dashboard`).then(result => result.data);
};

export const fetchApiCurrencyRates = (): Promise<ApiCurrencyRatesResponse> => {
    return apiInstance
        .get('/currency-rates', {
            params: {
                base: 'USD',
            },
        })
        .then(result => result.data);
};

export const fetchApiUser = (): Promise<ApiUserResponse> => {
    return apiInstance.get(`/users/self`).then(result => result.data);
};

export const updateApiUser = async (params: UpdateUserParams): Promise<ApiUserResponse> => {
    const response = await apiInstance.patch('/users/self', params);

    return response.data;
};

export const fetchApiKnownUsers = (): Promise<ApiFriendsResponse> => {
    return apiInstance.get(`/users/known-users`).then(result => result.data);
};

export const fetchApiUserActivities = ({
    limit,
    cursor,
}: FetchActivityParams = {}): Promise<ApiActivityItemsResponse> => {
    return apiInstance
        .get(`/users/self/activities`, {
            params: {
                ...(limit && { limit }),
                ...(cursor && { cursor }),
            },
        })
        .then(result => result.data);
};

// =============== EXPENSES ===============

export const createApiExpense = async ({
    groupId,
    description,
    amount,
    date,
    payerId,
    participantIds,
    currency,
    category,
    sharingMode,
}: CreateLedgerEntryParams): Promise<ApiLedgerEntryResponse> => {
    const resolvedSharingMode: SharingMode = sharingMode ?? { type: 'AUTO' };

    const response = await apiInstance.post('/ledger/entries', {
        type: 'EXPENSE',
        ...(groupId && { groupId }),
        expense: {
            description,
            amount,
            date,
            payerId,
            participantIds,
            currency,
            category: category ?? null,
            sharingMode: resolvedSharingMode,
        },
    });

    return response.data;
};

export const createApiSettlement = async ({
    groupId,
    fromUserId,
    toUserId,
    amount,
    currency,
}: CreateSettlementParams): Promise<ApiLedgerEntryResponse> => {
    const response = await apiInstance.post('/ledger/entries', {
        type: 'SETTLEMENT',
        ...(groupId && { groupId }),
        settlement: {
            fromUserId,
            toUserId,
            amount,
            currency,
        },
    });

    return response.data;
};
