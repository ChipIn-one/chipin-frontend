// Spec 04 §2.11 item 4 (04-2d; D19 option A): the blocking "App update required" state. 03-20 calls
// `showUpdateRequired()` on a 426 `CLIENT.OUTDATED` or an `X-Min-Client-Version` above the app
// version (contract BE-03-5); it closes the outbox gate with the reason `outdated` (replay stops
// until the update, the outbox is kept) and shows `UpdateRequiredScreen`.
//
// There is no build flag: the backend drives it. With no `MIN_CLIENT_VERSION` configured there
// (API-005) no response is a 426 and none carries `X-Min-Client-Version`, so this is never called.
import { useSyncExternalStore } from 'react';

import { SECOND } from 'constants/time';
import { outboxGate } from 'shared/offline/outboxGate';

/** How long the screen's button waits for a published worker to reach `waiting`. */
export const UPDATE_REQUIRED_WAIT_MS = 10 * SECOND;

let isRequired = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

const getIsRequired = (): boolean => isRequired;

/** Blocks the app until it is updated. */
export const showUpdateRequired = (): void => {
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
