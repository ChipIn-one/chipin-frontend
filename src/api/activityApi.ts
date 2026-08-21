import type { ActivityCategory } from 'constants/activity';

import { apiInstance } from './chipin.instance';
import type {
    ApiActivityChildrenResponse,
    ApiActivityFeedResponse,
    ApiActivityItemsResponse,
} from './chipin.raw.types';
import type {
    FetchActivitiesParams,
    FetchActivityChildrenParams,
} from './chipin.types';

const getPaginationParams = ({ limit, cursor }: FetchActivitiesParams): FetchActivitiesParams => {
    return {
        ...(limit !== undefined && { limit }),
        ...(cursor !== undefined && { cursor }),
    };
};

export const fetchActivities = ({
    limit,
    cursor,
}: FetchActivitiesParams = {}, signal?: AbortSignal): Promise<ApiActivityItemsResponse> => {
    return apiInstance
        .get<ApiActivityItemsResponse>('/users/self/activities', {
            params: getPaginationParams({ limit, cursor }),
            signal,
        })
        .then(response => response.data);
};

export const fetchActivityChildren = ({
    parentActivityId,
    limit,
    cursor,
    category,
}: FetchActivityChildrenParams, signal?: AbortSignal): Promise<ApiActivityChildrenResponse> => {
    const params: FetchActivitiesParams & { category?: ActivityCategory } = {
        ...getPaginationParams({ limit, cursor }),
        ...(category !== undefined && { category }),
    };

    return apiInstance
        .get<ApiActivityChildrenResponse>(`/users/self/activities/${parentActivityId}/children`, {
            params,
            signal,
        })
        .then(response => response.data);
};

export const fetchActivityPreviews = (
    params: FetchActivitiesParams,
    signal?: AbortSignal,
): Promise<ApiActivityFeedResponse> => {
    return apiInstance
        .get<ApiActivityFeedResponse>('/users/self/activity-previews', {
            params: getPaginationParams(params),
            signal,
        })
        .then(response => response.data);
};
