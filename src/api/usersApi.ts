import { apiInstance } from './chipin.instance';
import type { ApiFriendsResponse, ApiUserResponse } from './chipin.raw.types';
import type { RemoveKnownUserParams, UpdateUserParams } from './chipin.types';

const fetchUser = (): Promise<ApiUserResponse> => {
    return apiInstance.get<ApiUserResponse>('/users/self').then(response => response.data);
};

const updateUser = (params: UpdateUserParams): Promise<ApiUserResponse> => {
    return apiInstance
        .patch<ApiUserResponse>('/users/self', params)
        .then(response => response.data);
};

const fetchKnownUsers = (): Promise<ApiFriendsResponse> => {
    return apiInstance
        .get<ApiFriendsResponse>('/users/known-users')
        .then(response => response.data);
};

const removeKnownUser = ({ userId }: RemoveKnownUserParams): Promise<void> => {
    return apiInstance.delete<void>(`/users/known-users/${userId}`).then(() => undefined);
};

export { fetchKnownUsers, fetchUser, removeKnownUser, updateUser };
