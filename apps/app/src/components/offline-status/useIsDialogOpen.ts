import { useSyncExternalStore } from 'react';

// Radix dialog, alert dialog and sheet content while open (they are portaled into `<body>`). A
// Radix Popover is also `role="dialog"` but opens on pages too, where the inline banner is visible.
const OPEN_DIALOG_SELECTOR = [
    '[role="dialog"][data-state="open"]:not(.rt-PopoverContent)',
    '[role="alertdialog"][data-state="open"]',
].join(', ');

const getSnapshot = (): boolean => document.querySelector(OPEN_DIALOG_SELECTOR) !== null;

const getServerSnapshot = (): boolean => false;

const subscribe = (onChange: () => void): (() => void) => {
    const observer = new MutationObserver(onChange);

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributeFilter: ['data-state', 'role'],
    });
    return () => observer.disconnect();
};

/** Whether any dialog, alert dialog or sheet is open: it covers the inline offline banner. */
const useIsDialogOpen = (): boolean =>
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export { useIsDialogOpen };
