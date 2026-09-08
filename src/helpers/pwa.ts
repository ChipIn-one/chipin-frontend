export const checkIsPwaInstalled = (): boolean => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }

    const standaloneNavigator = window.navigator as Navigator & { standalone?: boolean };

    if (standaloneNavigator.standalone === true) {
        return true;
    }

    return false;
};
