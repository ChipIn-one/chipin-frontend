// Query cache constants (spec 03 §1.4).

/**
 * Bumped by hand only when the meaning of a persisted field changes without a type change
 * (e.g. seconds → ms in `entities/*\/model/to*.ts`). A type change is caught by
 * `MODEL_SHAPE_HASH`. Part of the query cache buster.
 */
export const QUERY_CACHE_EPOCH = 1;
