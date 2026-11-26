import { useSyncExternalStore } from 'react';

// Radix dialog, alert dialog and sheet content while open (they are portaled into `<body>`).
const OPEN_DIALOG_SELECTOR =
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

const getSnapshot = (): boolean => document.querySelector(OPEN_DIALOG_SELECTOR) !== null;

const getServerSnapshot = (): boolean => false;

const subscribe = (onChange: () => void): (() => void) => {
    const observer = new MutationObserver(onChange);

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-state', 'role'],
    });
    return () => observer.disconnect();
};

/** Whether any dialog, alert dialog or sheet is open: it covers the inline offline banner. */
const useIsDialogOpen = (): boolean =>
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export { useIsDialogOpen };
