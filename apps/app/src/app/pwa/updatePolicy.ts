// The service-worker update policy (spec 04 §2.11 items 1–3, 04-2d): the timings and the two
// localStorage stamps. Detection itself (startup, `visible`, hourly) is wired by
// `ServiceWorkerManager`; this module decides only from the stamps and the clock.
import { LS_KEY_SW_UPDATE_DISMISSED_AT, LS_KEY_SW_WAITING_SINCE } from 'constants/localstorage';
import { HOUR } from 'constants/time';
import { LocalStorage } from 'helpers/localStorage';

/** Item 1: the hourly update check while online. */
export const UPDATE_CHECK_INTERVAL_MS = HOUR;
/** Item 2: "Later" hides the prompt until the next `visible` after this long. */
export const UPDATE_SNOOZE_MS = 4 * HOUR;
/** Item 3: a waiting worker older than this is applied at the nearest safe point. */
export const FORCED_UPDATE_AFTER_MS = 24 * HOUR;

const readStamp = (key: typeof LS_KEY_SW_WAITING_SINCE | typeof LS_KEY_SW_UPDATE_DISMISSED_AT) => {
    const value: unknown = LocalStorage.get(key, 0);

    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

/** Records the first detection of a waiting worker; a later detection keeps the first time. */
export const noteWaitingWorker = (now: number): void => {
    if (readStamp(LS_KEY_SW_WAITING_SINCE) === null) {
        LocalStorage.set(LS_KEY_SW_WAITING_SINCE, now);
    }
};

/** No worker is waiting (the update was applied or none was published): the clock restarts. */
export const clearWaitingWorker = (): void => {
    LocalStorage.remove(LS_KEY_SW_WAITING_SINCE);
};

/** Item 3: the waiting worker has hung for more than 24 h since its first detection. */
export const isForcedUpdateDue = (now: number): boolean => {
    const since = readStamp(LS_KEY_SW_WAITING_SINCE);

    return since !== null && now - since > FORCED_UPDATE_AFTER_MS;
};

/** Item 2: the user chose "Later". */
export const snoozeUpdatePrompt = (now: number): void => {
    LocalStorage.set(LS_KEY_SW_UPDATE_DISMISSED_AT, now);
};

/** Item 2: the prompt may show (never snoozed, or the 4 h have passed). */
export const isUpdatePromptAllowed = (now: number): boolean => {
    const dismissedAt = readStamp(LS_KEY_SW_UPDATE_DISMISSED_AT);

    return dismissedAt === null || now - dismissedAt >= UPDATE_SNOOZE_MS;
};
