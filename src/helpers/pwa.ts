export const checkCanPwaBeInstalled = (): boolean => {
    // Already installed (Chrome, Edge, Android)
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }

    // Already installed (old iOS Safari)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window.navigator as any).standalone === true) {
        return true;
    }

    // If the browser supports beforeinstallprompt → installation is possible
    if ('onbeforeinstallprompt' in window) {
        return false;
    }

    // Browser does not support PWA installation
    return true;
};
