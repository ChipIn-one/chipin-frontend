// The service-worker update policy (spec 04 §2.11 items 1–3, 04-2d): the timings and the two
// localStorage stamps. Detection itself (startup, `visible`, hourly) is wired by
// `ServiceWorkerManager`; this module decides only from the stamps and the clock.
import { LS_KEY_SW_UPDATE_DISMISSED_AT, LS_KEY_SW_WAITING_SINCE } from 'constants/localstorage';
import { HOUR, MINUTE } from 'constants/time';
import { LocalStorage } from 'helpers/localStorage';

/** Item 1: the hourly update check while online. */
export const UPDATE_CHECK_INTERVAL_MS = HOUR;
/** Item 2: "Later" hides the prompt until the next `visible` after this long. */
export const UPDATE_SNOOZE_MS = 4 * HOUR;
/** Item 3: a waiting worker older than this is applied at the nearest safe point. */
export const FORCED_UPDATE_AFTER_MS = 24 * HOUR;

/** A stamp later than now by more than this was written under a wrong clock (skew, a reset). */
export const MAX_CLOCK_SKEW_MS = 5 * MINUTE;

type StampKey = typeof LS_KEY_SW_WAITING_SINCE | typeof LS_KEY_SW_UPDATE_DISMISSED_AT;

const readValidStamp = (key: StampKey): number | null => {
    const value: unknown = LocalStorage.get(key, 0);

    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

const isFromTheFuture = (stamp: number, now: number): boolean => stamp > now + MAX_CLOCK_SKEW_MS;

// The first detection; a stamp from the future is invalid and is rewritten as `now`, so a wrong
// clock neither forces an update at once nor postpones it forever.
const readWaitingSince = (now: number): number | null => {
    const since = readValidStamp(LS_KEY_SW_WAITING_SINCE);

    if (since !== null && isFromTheFuture(since, now)) {
        LocalStorage.set(LS_KEY_SW_WAITING_SINCE, now);
        return now;
    }
    return since;
};

/**
 * Records the first detection of a waiting worker; a later detection keeps the first time. A newer
 * worker that replaces the waiting one keeps it too: item 3 counts "since first detection", so a
 * release every few hours does not postpone the forced update forever.
 */
export const noteWaitingWorker = (now: number): void => {
    if (readWaitingSince(now) === null) {
        LocalStorage.set(LS_KEY_SW_WAITING_SINCE, now);
    }
};

/** No worker is waiting (the update was applied or none was published): the clock restarts. */
export const clearWaitingWorker = (): void => {
    LocalStorage.remove(LS_KEY_SW_WAITING_SINCE);
};

/** Item 3: the waiting worker has hung for more than 24 h since its first detection. */
export const isForcedUpdateDue = (now: number): boolean => {
    const since = readWaitingSince(now);

    return since !== null && now - since > FORCED_UPDATE_AFTER_MS;
};

/** Item 2: the user chose "Later". */
export const snoozeUpdatePrompt = (now: number): void => {
    LocalStorage.set(LS_KEY_SW_UPDATE_DISMISSED_AT, now);
};

/** Item 2: the prompt may show (never snoozed, or the 4 h have passed). */
export const isUpdatePromptAllowed = (now: number): boolean => {
    const dismissedAt = readValidStamp(LS_KEY_SW_UPDATE_DISMISSED_AT);

    // A snooze from the future is invalid: dropped, so the prompt is not hidden for good.
    if (dismissedAt !== null && isFromTheFuture(dismissedAt, now)) {
        LocalStorage.remove(LS_KEY_SW_UPDATE_DISMISSED_AT);
        return true;
    }
    return dismissedAt === null || now - dismissedAt >= UPDATE_SNOOZE_MS;
};
