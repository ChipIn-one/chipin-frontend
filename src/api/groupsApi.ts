import { apiInstance } from './chipin.instance';
import type { Group, UploadGroupCoverParams } from './chipin.types';

const uploadGroupCover = ({
    groupId,
    file,
    onProgress,
}: UploadGroupCoverParams): Promise<Group> => {
    const formData = new FormData();
    formData.append('file', file);

    return apiInstance
        .put<Group>(`/groups/${groupId}/cover`, formData, {
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

export { uploadGroupCover };
