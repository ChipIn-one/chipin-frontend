import { apiInstance } from './chipin.instance';
import type { ApiFriendsResponse, ApiUserResponse } from './chipin.raw.types';
import type {
    RemoveKnownUserParams,
    UpdateUserParams,
    UploadUserAvatarParams,
} from './chipin.types';

const fetchUser = (): Promise<ApiUserResponse> => {
    return apiInstance.get<ApiUserResponse>('/users/self').then(response => response.data);
};

const updateUser = (params: UpdateUserParams): Promise<ApiUserResponse> => {
    return apiInstance
        .patch<ApiUserResponse>('/users/self', params)
        .then(response => response.data);
};

const uploadUserAvatar = ({
    file,
    onProgress,
}: UploadUserAvatarParams): Promise<ApiUserResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    return apiInstance
        .put<ApiUserResponse>('/users/self/avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: event => {
                if (!event.total) {
                    return;
                }

                const progress = Math.round((event.loaded * 100) / event.total);
                onProgress?.(Math.min(Math.max(progress, 0), 100));
            },
        })
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

export { fetchKnownUsers, fetchUser, removeKnownUser, updateUser, uploadUserAvatar };
