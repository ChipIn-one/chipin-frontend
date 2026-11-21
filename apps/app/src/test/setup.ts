import { createElement, type JSXElementConstructor, type ReactNode } from 'react';
import { cleanup, type RenderHookOptions, type RenderOptions } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

import { SUPPORTED_LOCALES } from 'constants/locales';
import { resetTabUserId } from 'helpers/localStorage';
import { i18n, i18nReady } from 'i18n';

import { installFakeBroadcastChannel } from './broadcastChannel';
import { DefaultTestQueryProvider, resetTestQueryClients } from './renderWithQueryClient';
import { installFakeWebLocks } from './webLocks';

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

// A `@vitest-environment node` test (the public SSR/SSG graph) has no DOM: only the storage and
// the HTMLElement stubs below need one.
const hasDom = typeof window !== 'undefined';

if (hasDom) {
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: window.sessionStorage,
    });
}

class ResizeObserverMock implements ResizeObserver {
    disconnect = () => undefined;
    observe = () => undefined;
    unobserve = () => undefined;
}

Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
});

if (hasDom) {
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
}

// Every locale namespace is a lazy chunk (spec 04 §2.10): tests render with both languages loaded,
// as the synchronous resources did before, so a test can switch to `ru` without waiting.
beforeAll(() => i18nReady.then(() => i18n.loadLanguages([...SUPPORTED_LOCALES])));

// jsdom has no Web Locks: the outbox write lock (spec 03 §2.3) runs on an in-memory one; the
// outbox ping between tabs on an in-memory `BroadcastChannel`.
installFakeWebLocks();
installFakeBroadcastChannel();

afterEach(() => {
    installFakeWebLocks();
    installFakeBroadcastChannel();
    cleanup();
    resetTestQueryClients();
    // The next test reads this tab's user from the `LocalUser` it sets up.
    resetTabUserId();
});
