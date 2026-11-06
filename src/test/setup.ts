import { createElement, type JSXElementConstructor, type ReactNode } from 'react';
import { cleanup, type RenderHookOptions, type RenderOptions } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { DefaultTestQueryProvider, resetTestQueryClients } from './renderWithQueryClient';

type Wrapper = JSXElementConstructor<{ children: ReactNode }>;

// Every `render`/`renderHook` runs inside a QueryClientProvider (the app root always has one); a
// test's own wrapper or provider goes inside it and wins.
const withQueryProvider =
    (inner: Wrapper | undefined): Wrapper =>
    ({ children }) =>
        createElement(
            DefaultTestQueryProvider,
            null,
            inner ? createElement(inner, null, children) : children,
        );

vi.mock('@testing-library/react', async importOriginal => {
    const rtl = await importOriginal<typeof import('@testing-library/react')>();
    const render = (ui: ReactNode, options?: RenderOptions) =>
        rtl.render(ui, { ...options, wrapper: withQueryProvider(options?.wrapper) });
    const renderHook = (
        callback: (props: unknown) => unknown,
        options?: RenderHookOptions<unknown>,
    ) => rtl.renderHook(callback, { ...options, wrapper: withQueryProvider(options?.wrapper) });

    // The same calls with one more provider: the overloaded generic signatures stay as they are.
    return {
        ...rtl,
        render: render as typeof rtl.render,
        renderHook: renderHook as typeof rtl.renderHook,
    };
});

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
    resetTestQueryClients();
});
