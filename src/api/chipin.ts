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
    DeleteLedgerEntryParams,
    FetchActivityChildrenParams,
    FetchActivityParams,
    Group,
    InviteToGroupParams,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
    RemoveKnownUserParams,
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
    return apiInstance.get<Group[]>('/groups').then(result => result.data);
};

export const fetchApiUserGroupById = (groupId: string): Promise<Group> => {
    return apiInstance.get<Group>(`/groups/${groupId}`).then(result => result.data);
};

export const createApiGroup = ({
    groupName,
    groupDescription,
    groupEmoji,
}: CreateGroupParams): Promise<Group> => {
    return apiInstance
        .post<Group>('/groups', {
            name: groupName,
            ...(groupEmoji && { emoji: groupEmoji }),
            ...(groupDescription && { description: groupDescription }),
        })
        .then(response => response.data);
};

export const updateApiGroup = ({
    groupId,
    groupName,
    groupDescription,
    groupEmoji,
}: UpdateGroupParams): Promise<Group> => {
    return apiInstance
        .patch<Group>(`/groups/${groupId}`, {
            name: groupName,
            ...(groupEmoji && { emoji: groupEmoji }),
            ...(groupDescription && { description: groupDescription }),
        })
        .then(response => response.data);
};

export const removeApiGroup = ({
    groupId,
}: RemoveGroupParams): Promise<ApiRemoveGroupResponse> => {
    return apiInstance
        .delete<ApiRemoveGroupResponse>(`/groups/${groupId}`)
        .then(response => response.data);
};

export const leaveApiGroup = ({ groupId, newOwnerId }: LeaveGroupParams): Promise<void> => {
    return apiInstance
        .post<void>(`/groups/${groupId}/leave`, {
            ...(newOwnerId && { newOwnerId }),
        })
        .then(() => undefined);
};

export const kickApiGroupMember = ({
    groupId,
    userId,
}: KickGroupMemberParams): Promise<void> => {
    return apiInstance
        .post<void>(`/groups/${groupId}/members/${userId}/kick`)
        .then(() => undefined);
};

export const inviteApiUserToGroup = ({
    inviteToken,
}: InviteToGroupParams): Promise<Group> => {
    return apiInstance
        .post<Group>(`/groups/invite/${inviteToken}`)
        .then(response => response.data);
};

export const fetchApiDashboard = (): Promise<Dashboard> => {
    return apiInstance.get<Dashboard>('/dashboard').then(result => result.data);
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

export const removeApiKnownUser = async ({ userId }: RemoveKnownUserParams): Promise<void> => {
    await apiInstance.delete(`/users/known-users/${userId}`);
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

export const fetchApiUserActivityChildren = ({
    parentActivityId,
    limit,
    cursor,
    category,
}: FetchActivityChildrenParams): Promise<ApiActivityItemsResponse> => {
    return apiInstance
        .get(`/users/self/activities/${parentActivityId}/children`, {
            params: {
                ...(limit && { limit }),
                ...(cursor && { cursor }),
                ...(category && { category }),
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

export const deleteApiLedgerEntry = ({
    entryId,
}: DeleteLedgerEntryParams): Promise<void> => {
    return apiInstance.delete<void>(`/ledger/entries/${entryId}`).then(() => undefined);
};

export const createApiSettlement = ({
    groupId,
    fromUserId,
    toUserId,
    amount,
    currency,
}: CreateSettlementParams): Promise<ApiLedgerEntryResponse> => {
    return apiInstance
        .post<ApiLedgerEntryResponse>('/ledger/entries', {
            type: 'SETTLEMENT',
            ...(groupId && { groupId }),
            settlement: {
                fromUserId,
                toUserId,
                amount,
                currency,
            },
        })
        .then(response => response.data);
};
