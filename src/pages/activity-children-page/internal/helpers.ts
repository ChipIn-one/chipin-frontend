import type { AppEvent } from 'api/activity.types';
import type { Group } from 'api/chipin.types';

interface FindParentActivityEventParams {
    parentActivityId?: string;
    activityItems: AppEvent[];
    dashboardActivityItems: AppEvent[];
    selectedGroupActivities: AppEvent[];
    groups: Group[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const isRouteParentEvent = (value: unknown, activityId?: string): value is AppEvent => {
    return (
        isRecord(value) &&
        value.id === activityId &&
        typeof value.action === 'string' &&
        typeof value.createdAt === 'number'
    );
};

const findActivityEvent = (events: AppEvent[], activityId?: string): AppEvent | undefined => {
    for (const event of events) {
        if (event.id === activityId) {
            return event;
        }
    }

    return undefined;
};

export const getRouteParentEvent = (
    state: unknown,
    activityId?: string,
): AppEvent | undefined => {
    if (!isRecord(state)) {
        return undefined;
    }

    const parentActivityEvent = state.parentActivityEvent;

    return isRouteParentEvent(parentActivityEvent, activityId) ? parentActivityEvent : undefined;
};

export const findParentActivityEvent = ({
    parentActivityId,
    activityItems,
    dashboardActivityItems,
    selectedGroupActivities,
    groups,
}: FindParentActivityEventParams): AppEvent | undefined => {
    const activitySources = [activityItems, dashboardActivityItems, selectedGroupActivities];

    for (const activitySource of activitySources) {
        const event = findActivityEvent(activitySource, parentActivityId);

        if (event) {
            return event;
        }
    }

    for (const group of groups) {
        const event = findActivityEvent(group.recentActivities, parentActivityId);

        if (event) {
            return event;
        }
    }

    return undefined;
};
