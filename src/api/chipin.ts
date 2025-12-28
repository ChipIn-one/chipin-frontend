import axios from 'axios';
import { toast } from 'sonner';

import { getChipInApiUrl } from 'helpers/env';
import { resolveApiErrorMessage } from 'helpers/errors';
import { getAuthTokenDB } from 'store/IDB/auth';

import {
    ApiGroup,
    CreateGroupParams,
    DashboardApiResponse,
    InviteToGroupParams,
    RemoveGroupParams,
    RemoveGroupResponse,
} from './chipin.types';

const apiInstance = axios.create({
    baseURL: getChipInApiUrl(),
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
});

apiInstance.interceptors.request.use(async config => {
    const token = await getAuthTokenDB();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

apiInstance.interceptors.response.use(
    response => response,
    (error: unknown) => {
        let message: string;

        if (axios.isAxiosError(error)) {
            // 1. Network / offline
            if (!error.response) {
                message = resolveApiErrorMessage(undefined, 'apiErrors:network.offline');
            }

            // 2. Backend-defined error id
            else {
                message = resolveApiErrorMessage(error.response.data);
            }
        } else {
            message = resolveApiErrorMessage(undefined);
        }

        toast.error(message, {
            duration: SECOND * 15,
        });

        return Promise.reject(error);
    },
);

export const fetchApiUserGroups = (): Promise<ApiGroup[]> => {
    return apiInstance.get(`/groups`).then(result => result.data);
};

export const fetchApiUserGroupById = (groupId: string): Promise<ApiGroup> => {
    return apiInstance.get(`/groups/${groupId}`).then(result => result.data);
};

export const createApiGroup = async ({
    groupName,
    groupDescription,
    groupEmoji,
}: CreateGroupParams): Promise<ApiGroup> => {
    const response = await apiInstance.post('/groups', {
        name: groupName,
        ...(groupEmoji && { emoji: groupEmoji }),
        ...(groupDescription && { description: groupDescription }),
    });

    return response.data;
};

export const removeApiGroup = async ({
    groupId,
}: RemoveGroupParams): Promise<RemoveGroupResponse> => {
    const response = await apiInstance.delete(`/groups/${groupId}`);

    return response.data;
};

export const inviteApiUserToGroup = async ({
    inviteToken,
}: InviteToGroupParams): Promise<ApiGroup> => {
    const response = await apiInstance.post(`/groups/invite/${inviteToken}`);

    return response.data;
};

export const fetchApiDashboard = (): Promise<DashboardApiResponse> => {
    return apiInstance.get(`/dashboard`).then(result => result.data);
};
