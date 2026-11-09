import type { ActivityFeedItem, Group } from 'api/chipin.types';

/**
 * One page of the user's groups (`GET /groups`), newest first. LEGACY until 03-10c (member balances
 * to `Money`) and 03-12 (`recentActivities`): the items keep the `src/api` shape (number amounts)
 * that the group cards, the group page and the expense editor read today. The group detail
 * (`groups.detail`, `GET /groups/{groupId}`) caches the same legacy `Group`.
 *
 * Persisted, but `MODEL_SHAPE_HASH` sees only the name `Group`, not its shape: any change to the
 * legacy `Group` shape (`src/api/*.types.ts`) or to its normalization in `src/api` requires bumping
 * `QUERY_CACHE_EPOCH` (`shared/offline/constants.ts`).
 */
export interface GroupsListPage {
    readonly items: readonly Group[];
    /** Opaque: passed back as `cursor`, never parsed. */
    readonly nextCursor: string | null;
}

/**
 * One page of a group's activity previews (`GET /groups/{groupId}/activity-previews`), newest
 * first. LEGACY until 03-12: the items keep the `src/api` shape, like the dashboard feed; the same
 * `QUERY_CACHE_EPOCH` rule applies to the legacy `ActivityFeedItem` shape.
 */
export interface GroupActivityPage {
    readonly items: readonly ActivityFeedItem[];
    readonly nextCursor: number | null;
}
