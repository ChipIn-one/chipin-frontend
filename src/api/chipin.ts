import { AUTH_API_PATH, AUTH_CSRF_HEADERS } from './auth.constants';
import { apiInstance } from './chipin.instance';
import type {
    ApiCurrencyRatesResponse,
    ApiGroupsResponse,
    ApiOAuthTokenPairResponse,
    ApiRefreshTokenPairResponse,
    CreateGroupParams,
    Dashboard,
    Group,
    InviteToGroupParams,
    KickGroupMemberParams,
    LeaveGroupParams,
    RemoveGroupParams,
} from './chipin.types';

// =============== GROUPS AND USERS ===============

export const refreshApiAuthTokens = (): Promise<ApiRefreshTokenPairResponse> => {
    return apiInstance
        .post<ApiRefreshTokenPairResponse>(AUTH_API_PATH.REFRESH, undefined, {
            headers: AUTH_CSRF_HEADERS,
        })
        .then(response => response.data);
};

export const logoutApiAuthTokens = (): Promise<void> => {
    return apiInstance
        .post(AUTH_API_PATH.LOGOUT, undefined, {
            headers: AUTH_CSRF_HEADERS,
        })
        .then(() => undefined);
};

export const exchangeApiGoogleOAuthCode = (code: string): Promise<ApiOAuthTokenPairResponse> => {
    return apiInstance
        .post<ApiOAuthTokenPairResponse>(AUTH_API_PATH.GOOGLE_OAUTH_EXCHANGE, { code })
        .then(response => response.data);
};

export const fetchApiUserGroups = (signal?: AbortSignal): Promise<ApiGroupsResponse> => {
    return apiInstance
        .get<ApiGroupsResponse>('/groups', { signal })
        .then(result => result.data);
};

export const fetchApiUserGroupById = (
    groupId: string,
    signal?: AbortSignal,
): Promise<Group> => {
    return apiInstance
        .get<Group>(`/groups/${groupId}`, { signal })
        .then(result => result.data);
};

export const createApiGroup = ({
    groupName,
    groupDescription,
}: CreateGroupParams): Promise<Group> => {
    return apiInstance
        .post<Group>('/groups', {
            name: groupName,
            ...(groupDescription && { description: groupDescription }),
        })
        .then(response => response.data);
};

export const removeApiGroup = ({ groupId }: RemoveGroupParams): Promise<void> => {
    return apiInstance.delete<void>(`/groups/${groupId}`).then(() => undefined);
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

export const fetchApiDashboard = (signal?: AbortSignal): Promise<Dashboard> => {
    return apiInstance
        .get<Dashboard>('/dashboard', { signal })
        .then(result => result.data);
};

export const fetchApiCurrencyRates = (
    signal?: AbortSignal,
): Promise<ApiCurrencyRatesResponse> => {
    return apiInstance
        .get<ApiCurrencyRatesResponse>('/currency-rates', {
            params: {
                base: 'USD',
            },
            signal,
        })
        .then(result => result.data);
};
