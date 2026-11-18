// Spec 04 §2.11 item 4 (04-2d; D19 option A): the blocking "App update required" screen.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    onBeforeAppReload,
    resetAppUpdateForTests,
    setServiceWorkerControls,
} from 'helpers/appUpdate';
import { outboxGate } from 'shared/offline/outboxGate';

import {
    resetUpdateRequiredForTests,
    showUpdateRequired,
    UPDATE_REQUIRED_WAIT_MS,
} from './updateRequired';
import { UpdateRequiredScreen } from './UpdateRequiredScreen';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const reload = vi.fn();
const applyWaitingWorker = vi.fn(() => Promise.resolve());

const registrationWith = () => {
    const registration = {
        waiting: null as ServiceWorker | null,
        update: vi.fn(() => Promise.resolve()),
    };
    setServiceWorkerControls({
        update: applyWaitingWorker,
        getRegistration: () => registration as unknown as ServiceWorkerRegistration,
    });
    return registration;
};

const clickUpdate = () => {
    fireEvent.click(screen.getByRole('button', { name: /updateRequired\.action/ }));
};

beforeEach(() => {
    vi.useFakeTimers();
    resetAppUpdateForTests();
    resetUpdateRequiredForTests();
    outboxGate.reset();
    reload.mockClear();
    applyWaitingWorker.mockClear();
    vi.stubGlobal('location', { ...window.location, reload });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    outboxGate.reset();
    resetUpdateRequiredForTests();
    resetAppUpdateForTests();
});

describe('with the flag off (until BE-03-5)', () => {
    test('showUpdateRequired() changes nothing: no screen, the outbox gate stays open', () => {
        render(<UpdateRequiredScreen />);

        act(() => {
            showUpdateRequired();
        });

        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(outboxGate.isClosed('outdated')).toBe(false);
    });
});

describe('with VITE_FEATURE_UPDATE_REQUIRED=true', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_UPDATE_REQUIRED', 'true');
    });

    test('shows the blocking screen and closes the outbox gate with the reason outdated', () => {
        render(<UpdateRequiredScreen />);
        expect(screen.queryByRole('alertdialog')).toBeNull();

        act(() => {
            showUpdateRequired();
        });

        expect(screen.getByRole('alertdialog')).toBeTruthy();
        expect(screen.getByText('updateRequired.title')).toBeTruthy();
        expect(outboxGate.isClosed('outdated')).toBe(true);
        expect(outboxGate.isClosed('auth')).toBe(false);
    });

    test('the button asks for an update, waits up to 10 s, and without a new worker does not reload', async () => {
        const registration = registrationWith();
        const saved = vi.fn();
        onBeforeAppReload(saved);
        render(<UpdateRequiredScreen />);
        act(() => {
            showUpdateRequired();
        });

        clickUpdate();

        expect(registration.update).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', { name: /updateRequired\.checking/ })).toBeTruthy();

        await act(() => vi.advanceTimersByTimeAsync(UPDATE_REQUIRED_WAIT_MS - 1));
        expect(screen.queryByText('updateRequired.notPublished')).toBeNull();

        await act(() => vi.advanceTimersByTimeAsync(1));

        expect(screen.getByText('updateRequired.notPublished')).toBeTruthy();
        expect(applyWaitingWorker).not.toHaveBeenCalled();
        expect(saved).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
        // The screen stays and the user may try again.
        expect(screen.getByRole('button', { name: /updateRequired\.action/ })).toBeTruthy();
    });

    test('a worker that reaches waiting within 10 s is applied with updateServiceWorker(true)', async () => {
        const registration = registrationWith();
        render(<UpdateRequiredScreen />);
        act(() => {
            showUpdateRequired();
        });

        clickUpdate();
        await act(() => vi.advanceTimersByTimeAsync(3_000));
        expect(applyWaitingWorker).not.toHaveBeenCalled();

        registration.waiting = {} as ServiceWorker;
        await act(() => vi.advanceTimersByTimeAsync(500));

        expect(applyWaitingWorker).toHaveBeenCalledExactlyOnceWith(true);
        expect(screen.queryByText('updateRequired.notPublished')).toBeNull();
    });

    test('a worker already waiting is applied at once', async () => {
        const registration = registrationWith();
        registration.waiting = {} as ServiceWorker;
        render(<UpdateRequiredScreen />);
        act(() => {
            showUpdateRequired();
        });

        clickUpdate();
        await act(() => vi.advanceTimersByTimeAsync(0));

        expect(applyWaitingWorker).toHaveBeenCalledExactlyOnceWith(true);
    });

    test('without a service worker the button reloads through the onBeforeAppReload callbacks', async () => {
        const calls: string[] = [];
        onBeforeAppReload(() => calls.push('save'));
        reload.mockImplementation(() => calls.push('reload'));
        render(<UpdateRequiredScreen />);
        act(() => {
            showUpdateRequired();
        });

        clickUpdate();
        await act(() => vi.advanceTimersByTimeAsync(0));

        expect(calls).toEqual(['save', 'reload']);
    });
});
