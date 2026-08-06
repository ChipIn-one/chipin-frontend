import type { AuthTokens } from 'helpers/localStorage';

import { apiInstance } from './chipin.instance';
import type {
    ApiCurrencyRatesResponse,
    ApiGroupsResponse,
    ApiOAuthTokenPairResponse,
    ApiRefreshTokenPairResponse,
    ApiRemoveGroupResponse,
    CreateGroupParams,
    Dashboard,
    Group,
    InviteToGroupParams,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
    UpdateGroupParams,
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

export const exchangeApiGoogleOAuthCode = (code: string): Promise<ApiOAuthTokenPairResponse> => {
    return apiInstance
        .post<ApiOAuthTokenPairResponse>('/auth/oauth/google/exchange', { code })
        .then(response => response.data);
};

export const fetchApiUserGroups = (): Promise<ApiGroupsResponse> => {
    return apiInstance.get<ApiGroupsResponse>('/groups').then(result => result.data);
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

export const removeApiGroup = ({ groupId }: RemoveGroupParams): Promise<ApiRemoveGroupResponse> => {
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

export const kickApiGroupMember = ({ groupId, userId }: KickGroupMemberParams): Promise<void> => {
    return apiInstance
        .post<void>(`/groups/${groupId}/members/${userId}/kick`)
        .then(() => undefined);
};

export const inviteApiUserToGroup = ({ inviteToken }: InviteToGroupParams): Promise<Group> => {
    return apiInstance.post<Group>(`/groups/invite/${inviteToken}`).then(response => response.data);
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
