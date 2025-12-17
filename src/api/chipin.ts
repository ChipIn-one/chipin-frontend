import axios, { CanceledError } from 'axios';
import { toast } from 'sonner';
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

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// TODO: REFACTOR error handling to avoid duplication across different api files
// FOR DEV USAGE (PROD HANDLING TO BE IMPLEMENTED LATER)
apiInstance.interceptors.response.use(
    response => response,
    (error: unknown) => {
        if (error instanceof CanceledError) {
            return Promise.reject(error);
        }

        let title = 'Something went wrong';
        let description: string | undefined;

        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const data = error.response?.data;

            const method = error.config?.method?.toUpperCase();
            const url = error.config?.url;

            // 1. Message from backend → title
            if (typeof data === 'string' && data.trim()) {
                title = data;
            } else if (typeof data?.message === 'string') {
                title = data.message;
            } else if (typeof data?.error === 'string') {
                title = data.error;
            }

            // 2. Fallback title
            else if (status === 404) {
                title = 'Requested resource was not found';
            } else if (status === 401) {
                title = 'You are not authorized';
            } else if (status === 403) {
                title = 'You do not have access to this action';
            } else if (status && status >= 500) {
                title = 'Server error. Please try again later';
            }

            // 3. Description (always optional)
            description = [status && `Status: ${status}`, method && url && `${method} ${url}`]
                .filter(Boolean)
                .join(' · ');
        }

        toast.error(title, description ? { description, duration: SECOND * 15 } : undefined);

        return Promise.reject(error);
    },
);

// TODO: ADD abortSignal
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
    const response = await apiInstance.post(`/groups/invite/${inviteToken}`, undefined, {
        signal: abortSignal,
    });

    return response.data;
};
