// Reading the cached pages of the user's own activity feeds (the dashboard previews and the flat
// log of the Activity page).
import type { InfiniteData } from '@tanstack/react-query';

import type {
    ActivityEvent,
    ActivityItem,
    ActivityLogItem,
    ActivityPreview,
    SelfActivityEventsPage,
    SelfActivityPreviewsPage,
} from './types';

export type SelfActivityPreviewsData = InfiniteData<SelfActivityPreviewsPage, number | null>;
export type SelfActivityEventsData = InfiniteData<SelfActivityEventsPage, number | null>;

/** The loaded pages of a feed, whatever their page params. */
interface LoadedPages<P> {
    readonly pages: readonly P[];
}

const isPreview = (item: ActivityItem): item is ActivityPreview => !('kind' in item);
const isEvent = (item: ActivityLogItem): item is ActivityEvent => !('kind' in item);

/**
 * The previews of all loaded pages in order. An invalid item (an unreadable amount, reported when
 * mapped) is left out. A later page may repeat a parent: the reader keeps its newest event.
 */
export const loadedActivityPreviews = (
    data: LoadedPages<SelfActivityPreviewsPage> | undefined,
): ActivityPreview[] => data?.pages.flatMap(page => page.items.filter(isPreview)) ?? [];

/**
 * The events of all loaded pages in order, each event once: the backend pages by `seq < cursor`,
 * so pages do not overlap, and a repeated id would only break the list's keys. An invalid item
 * (an unreadable amount, reported when mapped) is left out.
 */
export const loadedActivityEvents = (
    data: LoadedPages<SelfActivityEventsPage> | undefined,
): ActivityEvent[] => {
    const events = new Map<string, ActivityEvent>();

    for (const page of data?.pages ?? []) {
        for (const event of page.items.filter(isEvent)) {
            if (!events.has(event.id)) {
                events.set(event.id, event);
            }
        }
    }
    return [...events.values()];
};

/** The first page only (a refetch then sends one request, not one per loaded page). */
export const firstPageOnly = <P>(
    data: InfiniteData<P, number | null>,
): InfiniteData<P, number | null> => ({
    pages: data.pages.slice(0, 1),
    pageParams: data.pageParams.slice(0, 1),
});
