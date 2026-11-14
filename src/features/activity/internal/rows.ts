// The rows of an activity list as domain events (amounts as `Money`): from domain previews (the
// dashboard and group feeds), from domain events (the Activity page), or from the legacy items of
// the expense history, which the legacy bridge of `entities/balance` carries into the domain here.
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

/** A flat history: every event is its own row. */
export const eventRows = (events: readonly ActivityEvent[]): ActivityRow[] =>
    events.map(event => ({ original: event, event, isPreview: false }));

// LEGACY until 12c migrates the expense history (the activity store's children).
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
