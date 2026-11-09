// Reading the cached pages of a group's activity: one list of previews, each parent once.
import type { InfiniteData } from '@tanstack/react-query';

import type { ActivityFeedItem } from 'api/chipin.types';

import type { GroupActivityPage } from './types';

export type GroupActivityData = InfiniteData<GroupActivityPage, number | null>;

/**
 * The previews of all loaded pages in order, each parent once: a later page may repeat a parent
 * (an edit or reversal moved it), and its newer event replaces the one listed, in place (kept as
 * a tombstone when it is a reversal).
 */
export const flattenGroupActivity = (data: GroupActivityData): ActivityFeedItem[] => {
    const items: ActivityFeedItem[] = [];
    const indexByParent = new Map<string, number>();

    for (const page of data.pages) {
        for (const item of page.items) {
            const index = indexByParent.get(item.parent.id);
            const listed = index === undefined ? undefined : items[index];

            if (index === undefined) {
                indexByParent.set(item.parent.id, items.length);
                items.push(item);
            } else if (listed === undefined || item.lastEvent.seq > listed.lastEvent.seq) {
                items[index] = item;
            }
        }
    }
    return items;
};

/** The first page only (a refetch then sends one request, not one per loaded page). */
export const firstGroupActivityPage = (data: GroupActivityData): GroupActivityData => ({
    pages: data.pages.slice(0, 1),
    pageParams: data.pageParams.slice(0, 1),
});
