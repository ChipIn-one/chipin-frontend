import axios, { CanceledError } from 'axios';
import { ApiGroup } from 'types/api';

import { getChipInApiUrl } from 'helpers/env';
import { getAuthTokenDB } from 'store/IDB/auth';

import { CreateGroupParams, InviteToGroupParams } from './chipin.types';

const apiInstance = axios.create({
    baseURL: getChipInApiUrl(),
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
});

apiInstance.interceptors.request.use(async config => {
    const token = await getAuthTokenDB();
    console.log(token);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

apiInstance.interceptors.response.use(
    response => response,
    error => {
        if (error instanceof CanceledError) {
            return Promise.reject(error);
        }

        return Promise.reject(error);
        // return Promise.reject(new NetworkErrok(error));
    },
);

export const fetchApiUserGroups = (): Promise<ApiGroup[]> => {
    return apiInstance.get(`/groups`).then(result => result.data);
};

export const createApiGroup = async (
    { groupName, groupDescription = '' }: CreateGroupParams,
    abortSignal?: AbortSignal,
): Promise<ApiGroup> => {
    const response = await apiInstance.post(
        '/groups',
        { name: groupName, description: groupDescription },
        { signal: abortSignal },
    );

    return response.data;
};

export const inviteApiUserToGroup = async (
    { inviteToken }: InviteToGroupParams,
    abortSignal?: AbortSignal,
): Promise<ApiGroup> => {
    const response = await apiInstance.post(`/groups/invite/${inviteToken}`, {
        signal: abortSignal,
    });

    return response.data;
};
