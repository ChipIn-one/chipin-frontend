// The rows of an activity list as domain events (amounts as `Money`), from domain previews (the
// group feed) or from the legacy items of the not-yet-migrated feeds (the dashboard, the activity
// store), which the legacy bridge of `entities/balance` carries into the domain at this boundary.
import type { ActivityEvent, ActivityPreview } from 'entities/activity';
import { legacyActivityEvent } from 'entities/balance';
import { type ActivityListItem, isActivityPreview } from 'helpers/activityEvent';

export interface ActivityRow {
    /** The chain's creation event (a preview) or the event itself (a flat history). */
    readonly original: ActivityEvent;
    /** The event shown: the chain's latest event, or the event itself. */
    readonly event: ActivityEvent;
    readonly isPreview: boolean;
}

export const previewRows = (previews: readonly ActivityPreview[]): ActivityRow[] =>
    previews.map(preview => ({
        original: preview.parent,
        event: preview.lastEvent,
        isPreview: true,
    }));

// LEGACY until 12b/12c migrate the dashboard feed and the activity store.
export const legacyActivityRows = (items: readonly ActivityListItem[]): ActivityRow[] =>
    items.map(item => {
        if (isActivityPreview(item)) {
            return {
                original: legacyActivityEvent(item.parent),
                event: legacyActivityEvent(item.lastEvent),
                isPreview: true,
            };
        }
        const event = legacyActivityEvent(item);

        return { original: event, event, isPreview: false };
    });
