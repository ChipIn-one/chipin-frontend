// Query cache constants (spec 03 §1.4).

/**
 * Bumped by hand only when the meaning of a persisted field changes without a type change
 * (e.g. seconds → ms in `entities/*\/model/to*.ts`). A type change is caught by
 * `MODEL_SHAPE_HASH`. Part of the query cache buster.
 */
export const QUERY_CACHE_EPOCH = 1;

/** The IndexedDB key of a user's query cache (§1.2). */
export const queryCacheKey = (userId: string): string => `chipin:rq:${userId}`;

/** The outbox keys of a user (§2.3); written from 03-15b, deleted by `clearUserData` already. */
export const outboxKeys = (userId: string): string[] => [
    `chipin:outbox:${userId}`,
    `chipin:outbox-failed:${userId}`,
    `chipin:outbox-inbox:${userId}`,
];
