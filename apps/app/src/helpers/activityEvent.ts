import type { AppEvent } from 'api/activity.types';
import type { ActivityFeedItem } from 'api/chipin.types';
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, type ActivityCategory } from 'constants/activity';

// The helpers read only these fields, so they serve the legacy events and the domain events
// (`entities/activity`) alike.
interface ActionLike {
    readonly action: string;
}

interface LedgerEventLike extends ActionLike {
    readonly metadata?: object | null;
}

export interface ActivitySubeventsView<E = AppEvent> {
    originalEvent: E;
    currentEvent: E;
}

export const getActivityCategory = (event?: ActionLike): ActivityCategory | undefined => {
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

export const getActivityLedgerEntryId = (event?: LedgerEventLike): string | undefined => {
    const metadata = event?.metadata;

    if (!metadata || !('entryId' in metadata) || typeof metadata.entryId !== 'string') {
        return undefined;
    }

    if (
        event.action === ACTIVITY_ACTIONS.EXPENSE_CREATED ||
        event.action === ACTIVITY_ACTIONS.EXPENSE_UPDATED ||
        event.action === ACTIVITY_ACTIONS.SETTLEMENT_CREATED
    ) {
        return metadata.entryId;
    }

    return undefined;
};

export type ActivityListItem = AppEvent | ActivityFeedItem;

export const isActivityPreview = (item: ActivityListItem): item is ActivityFeedItem =>
    'parent' in item && 'lastEvent' in item;

/** The fields of a preview this helper reads: legacy `ActivityFeedItem` and domain previews. */
interface PreviewLike {
    readonly parent: { readonly id: string };
    readonly lastEvent: { readonly seq: number; readonly action: string };
}

export const getActivityPreviewEvents = <T extends PreviewLike>(items: readonly T[]): T[] => {
    const latestByParent = new Map<string, T>();

    for (const item of items) {
        const existing = latestByParent.get(item.parent.id);
        // Parent insertion order is immutable; the highest event seq is current state.
        if (!existing || item.lastEvent.seq > existing.lastEvent.seq) {
            latestByParent.set(item.parent.id, item);
        }
    }

    const previews: T[] = [];

    for (const item of latestByParent.values()) {
        if (
            item.lastEvent.action === ACTIVITY_ACTIONS.EXPENSE_REVERSED ||
            item.lastEvent.action === ACTIVITY_ACTIONS.SETTLEMENT_REVERSED
        ) {
            continue;
        }

        previews.push(item);
    }

    return previews;
};

export const getActivitySubeventsView = <
    P extends { readonly seq: number },
    C extends { readonly seq: number },
>(
    parentEvent: P | null | undefined,
    childEvents: readonly C[],
): ActivitySubeventsView<P | C> | undefined => {
    if (!parentEvent) {
        return undefined;
    }

    let currentEvent: P | C = parentEvent;

    for (const childEvent of childEvents) {
        if (childEvent.seq > currentEvent.seq) {
            currentEvent = childEvent;
        }
    }

    return { originalEvent: parentEvent, currentEvent };
};
