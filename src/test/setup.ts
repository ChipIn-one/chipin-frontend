import { afterEach } from 'vitest';

import { cleanup } from '@testing-library/react';

Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: window.sessionStorage,
});

class ResizeObserverMock implements ResizeObserver {
    disconnect = () => undefined;
    observe = () => undefined;
    unobserve = () => undefined;
}

Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
});

Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: {
        configurable: true,
        value: () => false,
    },
    releasePointerCapture: {
        configurable: true,
        value: () => undefined,
    },
    scrollIntoView: {
        configurable: true,
        value: () => undefined,
    },
    setPointerCapture: {
        configurable: true,
        value: () => undefined,
    },
});

afterEach(() => {
    cleanup();
});
