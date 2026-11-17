import { beforeEach, expect, test, vi } from 'vitest';

import { usePwaStore } from './pwaStore';

const captureException = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock('@sentry/react', () => ({
    captureException,
}));

vi.mock('helpers/pwa', () => ({
    checkIsPwaInstalled: () => false,
}));

vi.mock('sonner', () => ({
    toast: { success: toastSuccess },
}));

const createPromptEvent = (
    prompt: () => Promise<void>,
    outcome: 'accepted' | 'dismissed' = 'dismissed',
): BeforeInstallPromptEvent =>
    ({
        platforms: [],
        prompt,
        userChoice: Promise.resolve({ outcome, platform: 'web' }),
    }) as unknown as BeforeInstallPromptEvent;

beforeEach(() => {
    captureException.mockReset();
    toastSuccess.mockReset();
    usePwaStore.setState({ isPwaInstalled: false, pwaInstallPrompt: null });
});

test('resolves, clears the prompt and reports the error when prompt() rejects', async () => {
    const error = new Error('prompt already used');
    usePwaStore.setState({ pwaInstallPrompt: createPromptEvent(() => Promise.reject(error)) });

    await expect(usePwaStore.getState().callPWAInstall()).resolves.toBeUndefined();

    expect(usePwaStore.getState().pwaInstallPrompt).toBeNull();
    expect(usePwaStore.getState().isPwaInstalled).toBe(false);
    expect(captureException).toHaveBeenCalledWith(error);
    expect(toastSuccess).not.toHaveBeenCalled();
});

test('marks the app installed when the user accepts the prompt', async () => {
    usePwaStore.setState({
        pwaInstallPrompt: createPromptEvent(() => Promise.resolve(), 'accepted'),
    });

    await usePwaStore.getState().callPWAInstall();

    expect(usePwaStore.getState()).toMatchObject({ isPwaInstalled: true, pwaInstallPrompt: null });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(captureException).not.toHaveBeenCalled();
});

test('clears the prompt without installing when the user dismisses it', async () => {
    usePwaStore.setState({ pwaInstallPrompt: createPromptEvent(() => Promise.resolve()) });

    await usePwaStore.getState().callPWAInstall();

    expect(usePwaStore.getState()).toMatchObject({ isPwaInstalled: false, pwaInstallPrompt: null });
    expect(captureException).not.toHaveBeenCalled();
});

test('resolves, clears the prompt and reports the error when userChoice rejects', async () => {
    const error = new Error('user choice failed');
    // A getter creates the rejected promise only when the store reads it.
    const promptEvent = {
        platforms: [],
        prompt: () => Promise.resolve(),
        get userChoice() {
            return Promise.reject(error);
        },
    } as unknown as BeforeInstallPromptEvent;
    usePwaStore.setState({ pwaInstallPrompt: promptEvent });

    await expect(usePwaStore.getState().callPWAInstall()).resolves.toBeUndefined();

    expect(usePwaStore.getState()).toMatchObject({ isPwaInstalled: false, pwaInstallPrompt: null });
    expect(captureException).toHaveBeenCalledWith(error);
    expect(toastSuccess).not.toHaveBeenCalled();
});

test('resolves and keeps the installed state when the success toast throws', async () => {
    const error = new Error('toast failed');
    toastSuccess.mockImplementation(() => {
        throw error;
    });
    usePwaStore.setState({
        pwaInstallPrompt: createPromptEvent(() => Promise.resolve(), 'accepted'),
    });

    await expect(usePwaStore.getState().callPWAInstall()).resolves.toBeUndefined();

    expect(usePwaStore.getState()).toMatchObject({ isPwaInstalled: true, pwaInstallPrompt: null });
    expect(captureException).toHaveBeenCalledWith(error);
});
