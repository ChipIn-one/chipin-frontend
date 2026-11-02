import { useSyncExternalStore } from 'react';

const subscribe = (onStoreChange: () => void): (() => void) => {
    window.addEventListener('online', onStoreChange);
    window.addEventListener('offline', onStoreChange);

    return () => {
        window.removeEventListener('online', onStoreChange);
        window.removeEventListener('offline', onStoreChange);
    };
};

const getSnapshot = (): boolean => navigator.onLine;

// Prerendered public pages have no network state; treat them as online.
const getServerSnapshot = (): boolean => true;

export const useOnlineStatus = (): boolean =>
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
