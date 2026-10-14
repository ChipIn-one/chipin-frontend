import type { AppEvent } from 'api/activity.types';
import type { ActivityFeedItem } from 'api/chipin.types';
import {
    ACTIVITY_ACTIONS,
    ACTIVITY_CATEGORIES,
    type ActivityCategory,
} from 'constants/activity';

export interface ActivitySubeventsView {
    originalEvent: AppEvent;
    currentEvent: AppEvent;
}

export const getActivityCategory = (event?: AppEvent): ActivityCategory | undefined => {
    if (
        event?.action === ACTIVITY_ACTIONS.EXPENSE_CREATED ||
        event?.action === ACTIVITY_ACTIONS.EXPENSE_UPDATED
    ) {
        return ACTIVITY_CATEGORIES.EXPENSE;
    }

    if (event?.action === ACTIVITY_ACTIONS.SETTLEMENT_CREATED) {
        return ACTIVITY_CATEGORIES.SETTLEMENT;
    }

    return undefined;
};

export const getActivityLedgerEntryId = (event?: AppEvent): string | undefined => {
    if (!event?.metadata) {
        return undefined;
    }

    if (
        event.action === ACTIVITY_ACTIONS.EXPENSE_CREATED ||
        event.action === ACTIVITY_ACTIONS.EXPENSE_UPDATED ||
        event.action === ACTIVITY_ACTIONS.SETTLEMENT_CREATED
    ) {
        return event.metadata.entryId;
    }

    return undefined;
};

export type ActivityListItem = AppEvent | ActivityFeedItem;

export const isActivityPreview = (item: ActivityListItem): item is ActivityFeedItem =>
    'parent' in item && 'lastEvent' in item;

export const getActivityPreviewEvents = (
    items: readonly ActivityFeedItem[],
): ActivityFeedItem[] => {
    const seenParents = new Set<string>();
    const previews: ActivityFeedItem[] = [];

    for (const item of items) {
        if (
            seenParents.has(item.parent.id) ||
            item.lastEvent.action === ACTIVITY_ACTIONS.EXPENSE_REVERSED ||
            item.lastEvent.action === ACTIVITY_ACTIONS.SETTLEMENT_REVERSED
        ) {
            continue;
        }

        seenParents.add(item.parent.id);
        previews.push(item);
    }

    return previews;
};

export const getActivitySubeventsView = (
    parentEvent: AppEvent | null | undefined,
    childEvents: readonly AppEvent[],
): ActivitySubeventsView | undefined => {
    if (!parentEvent) {
        return undefined;
    }

    let currentEvent = parentEvent;

    for (const childEvent of childEvents) {
        if (childEvent.seq > currentEvent.seq) {
            currentEvent = childEvent;
        }
    }

    return { originalEvent: parentEvent, currentEvent };
};
