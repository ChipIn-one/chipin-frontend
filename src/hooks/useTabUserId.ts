import { useSyncExternalStore } from 'react';

import { getTabUserId, subscribeTabUserId } from 'helpers/localStorage';

/** This tab's user (`getTabUserId`): re-renders when this tab signs in, switches or signs out. */
export const useTabUserId = (): string | undefined =>
    useSyncExternalStore(subscribeTabUserId, getTabUserId, getTabUserId);
