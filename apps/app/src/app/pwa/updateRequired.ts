// Spec 04 §2.11 item 4 (04-2d; D19 option A): the blocking "App update required" state. 03-20 calls
// `showUpdateRequired()` on a 426 `CLIENT.OUTDATED` or an `X-Min-Client-Version` above the app
// version (contract BE-03-5); it closes the outbox gate with the reason `outdated` (replay stops
// until the update, the outbox is kept) and shows `UpdateRequiredScreen`.
//
// Behind the build flag `VITE_FEATURE_UPDATE_REQUIRED` (on only when exactly `true`), off until
// BE-03-5 ships. With the flag off `showUpdateRequired()` is a no-op: it neither shows the screen
// nor closes the gate, so production behaviour does not change (a closed gate with no screen would
// silently stop the outbox with nothing to recover it).
import { useSyncExternalStore } from 'react';

import { SECOND } from 'constants/time';
import { outboxGate } from 'shared/offline/outboxGate';

/** How long the screen's button waits for a published worker to reach `waiting`. */
export const UPDATE_REQUIRED_WAIT_MS = 10 * SECOND;

export const isUpdateRequiredFlagOn = (): boolean =>
    import.meta.env.VITE_FEATURE_UPDATE_REQUIRED === 'true';

let isRequired = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

const getIsRequired = (): boolean => isRequired;

/** Blocks the app until it is updated; a no-op with the flag off. */
export const showUpdateRequired = (): void => {
    if (!isUpdateRequiredFlagOn()) {
        return;
    }
    outboxGate.close('outdated');
    if (isRequired) {
        return;
    }
    isRequired = true;
    listeners.forEach(listener => {
        listener();
    });
};

export const useIsUpdateRequired = (): boolean =>
    useSyncExternalStore(subscribe, getIsRequired, getIsRequired);

/** Tests only. */
export const resetUpdateRequiredForTests = (): void => {
    isRequired = false;
    listeners.clear();
};
