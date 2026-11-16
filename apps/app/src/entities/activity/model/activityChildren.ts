// Reading the cached pages of an activity chain's history (the expense history page).
import type { InfiniteData } from '@tanstack/react-query';

import { loadedActivityEvents } from './selfActivity';
import type { ActivityChildrenPage, ActivityEvent } from './types';

export type ActivityChildrenData = InfiniteData<ActivityChildrenPage, number | null>;

export interface LoadedActivityChildren {
    /**
     * The chain's creation event, from the first loaded page (every page repeats it); undefined
     * when its amounts cannot be read (reported when mapped).
     */
    readonly parent: ActivityEvent | undefined;
    /** The later events of all loaded pages, newest first, each once; invalid items left out. */
    readonly events: ActivityEvent[];
    /**
     * A loaded later event is invalid (unreadable): the current state may be newer than the events
     * shown, so nothing may be edited or deleted from them.
     */
    readonly hasInvalidEvents: boolean;
}

export const loadedActivityChildren = (
    data: { readonly pages: readonly ActivityChildrenPage[] } | undefined,
): LoadedActivityChildren => {
    const parent = data?.pages[0]?.parent;

    return {
        parent: parent && !('kind' in parent) ? parent : undefined,
        events: loadedActivityEvents(data),
        hasInvalidEvents:
            data?.pages.some(page => page.items.some(item => 'kind' in item)) ?? false,
    };
};
