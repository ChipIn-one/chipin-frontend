import axios from 'axios';
import { toast } from 'sonner';

import { SECOND } from 'constants/time';
import { getChipInApiUrl } from 'helpers/env';
import { resolveApiErrorMessage } from 'helpers/errors';
import { getAuthTokenDB } from 'store/IDB/auth';

import {
    ApiGroup,
    ApiUser,
    CreateGroupParams,
    CreateLedgerEntryParams,
    DashboardApiResponse,
    InviteToGroupParams,
    RemoveGroupParams,
    RemoveGroupResponse,
    UpdateGroupParams,
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

// =============== GROUPS AND USERS ===============

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

export const updateApiGroup = async ({
    groupId,
    groupName,
    groupDescription,
    groupEmoji,
}: UpdateGroupParams): Promise<ApiGroup> => {
    const response = await apiInstance.patch(`/groups/${groupId}`, {
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

export const fetchApiUser = (): Promise<ApiUser> => {
    return apiInstance.get(`/users/self`).then(result => result.data);
};

export const fetchApiKnownUsers = (): Promise<ApiUser[]> => {
    return apiInstance.get(`/users/known-users`).then(result => result.data);
};

// =============== EXPENSES ===============

export const createApiLedgerEntry = async ({
    groupId,
    description,
    amount,
    unixTimestamp,
    payerId,
    participantIds,
    currency,
}: CreateLedgerEntryParams) => {
    const response = await apiInstance.post('/ledger/entries', {
        type: 'EXPENSE',
        groupId,
        expense: {
            description,
            amount: String(amount),
            date: unixTimestamp,
            payerId,
            participantIds,
            currency,
            sharingMode: {
                type: 'AUTO',
            },
        },
    });

    return response.data;
};
