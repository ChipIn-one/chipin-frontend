import { apiPath } from './apiPath';
import { apiInstance } from './chipin.instance';
import type { Group, UpdateGroupParams, UploadGroupCoverParams } from './chipin.types';

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const hasSupportedGroupResponse = (value: unknown): value is { simplifyDebts: boolean } => {
    return isRecord(value) && typeof value.simplifyDebts === 'boolean';
};

const updateGroup = ({
    groupId,
    groupName,
    groupDescription,
    simplifyDebts,
}: UpdateGroupParams): Promise<Group> => {
    const payload = {
        ...(groupName !== undefined && { name: groupName }),
        ...(groupDescription !== undefined && { description: groupDescription }),
        ...(simplifyDebts !== undefined && { simplifyDebts }),
    };

    return Promise.resolve()
        .then(() => apiInstance.patch<Group>(apiPath`/groups/${groupId}`, payload))
        .then(response => {
            if (!hasSupportedGroupResponse(response.data)) {
                throw new Error('Unsupported group simplifyDebts response');
            }

            return response.data;
        });
};

const uploadGroupCover = ({
    groupId,
    file,
    onProgress,
}: UploadGroupCoverParams): Promise<Group> => {
    const formData = new FormData();
    formData.append('file', file);

    return Promise.resolve()
        .then(() => apiInstance.put<Group>(apiPath`/groups/${groupId}/cover`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: event => {
                if (!event.total) {
                    return;
                }

                const progress = Math.round((event.loaded * 100) / event.total);
                onProgress?.(Math.min(Math.max(progress, 0), 100));
            },
        }))
        .then(response => response.data);
};

export { updateGroup, uploadGroupCover };
