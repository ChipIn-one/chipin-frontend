import { apiInstance } from './chipin.instance';
import type { ApiFriendsResponse, ApiSelfUserResponse } from './chipin.raw.types';
import type {
    RemoveKnownUserParams,
    UpdateUserParams,
    UploadUserAvatarParams,
} from './chipin.types';

const fetchUser = (signal?: AbortSignal): Promise<ApiSelfUserResponse> => {
    return apiInstance
        .get<ApiSelfUserResponse>('/users/self', { signal })
        .then(response => response.data);
};

const updateUser = (params: UpdateUserParams): Promise<ApiSelfUserResponse> => {
    return apiInstance
        .patch<ApiSelfUserResponse>('/users/self', params)
        .then(response => response.data);
};

const uploadUserAvatar = ({
    file,
    onProgress,
}: UploadUserAvatarParams): Promise<ApiSelfUserResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    return apiInstance
        .put<ApiSelfUserResponse>('/users/self/avatar', formData, {
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

const fetchKnownUsers = (signal?: AbortSignal): Promise<ApiFriendsResponse> => {
    return apiInstance
        .get<ApiFriendsResponse>('/users/known-users', { signal })
        .then(response => response.data);
};

const removeKnownUser = ({ userId }: RemoveKnownUserParams): Promise<void> => {
    return apiInstance.delete<void>(`/users/known-users/${userId}`).then(() => undefined);
};

export { fetchKnownUsers, fetchUser, removeKnownUser, updateUser, uploadUserAvatar };
