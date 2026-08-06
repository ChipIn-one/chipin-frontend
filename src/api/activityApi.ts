import type { ActivityCategory } from 'constants/activity';

import type { AppEvent } from './activity.types';
import { apiInstance } from './chipin.instance';
import type { ApiActivityFeedResponse, ApiActivityItemsResponse } from './chipin.raw.types';
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
}: FetchActivitiesParams = {}): Promise<ApiActivityItemsResponse> => {
    return apiInstance
        .get<ApiActivityItemsResponse>('/users/self/activities', {
            params: getPaginationParams({ limit, cursor }),
        })
        .then(response => response.data);
};

export const fetchActivity = (activityId: string): Promise<AppEvent> => {
    return apiInstance
        .get<AppEvent>(`/users/self/activities/${activityId}`)
        .then(response => response.data);
};

export const fetchActivityChildren = ({
    parentActivityId,
    limit,
    cursor,
    category,
}: FetchActivityChildrenParams): Promise<ApiActivityItemsResponse> => {
    const params: FetchActivitiesParams & { category?: ActivityCategory } = {
        ...getPaginationParams({ limit, cursor }),
        ...(category !== undefined && { category }),
    };

    return apiInstance
        .get<ApiActivityItemsResponse>(`/users/self/activities/${parentActivityId}/children`, {
            params,
        })
        .then(response => response.data);
};

export const fetchActivityPreviews = (
    params: FetchActivitiesParams,
): Promise<ApiActivityFeedResponse> => {
    return apiInstance
        .get<ApiActivityFeedResponse>('/users/self/activity-previews', {
            params: getPaginationParams(params),
        })
        .then(response => response.data);
};
