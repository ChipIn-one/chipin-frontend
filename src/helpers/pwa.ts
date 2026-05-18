export const checkIsPwaInstalled = (): boolean => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window.navigator as any).standalone === true) {
        return true;
    }

    return false;
};

export const checkIsPwaInstallable = (): boolean => {
    // Already running as installed PWA — not installable
    if (checkIsPwaInstalled()) {
        return false;
    }

    // Browser supports beforeinstallprompt — installation is possible
    return 'onbeforeinstallprompt' in window;
};
