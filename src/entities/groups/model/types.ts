import type { Group } from 'api/chipin.types';
import type { ActivityItem } from 'entities/activity';

/**
 * One page of the user's groups (`GET /groups`), newest first. LEGACY until 03-10c (member balances
 * to `Money`): the items keep the `src/api` shape (number amounts) that the group cards, the group
 * page and the expense editor read today; their `recentActivities` are legacy too (the group page
 * carries them into the domain activity with the legacy bridge of `entities/balance`). The group detail
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
 * first, as domain items (amounts as `Money`, `toActivityItems`); a preview with an unreadable
 * amount is an invalid item.
 */
export interface GroupActivityPage {
    readonly items: readonly ActivityItem[];
    readonly nextCursor: number | null;
}
