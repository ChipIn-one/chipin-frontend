import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import { ROUTES } from 'constants/routes';
import { APP_VERSION } from 'constants/version';

const mocks = vi.hoisted(() => ({
    updateServiceWorker: vi.fn<(reloadPage?: boolean) => Promise<void>>(),
    captureMessage: vi.fn(),
    checkForServiceWorkerUpdate: vi.fn<() => Promise<boolean>>(),
    reloadApp: vi.fn(),
}));

vi.mock('@sentry/react', () =>
    vi.importActual<typeof import('@sentry/react')>('@sentry/react').then(actual => ({
        ...actual,
        captureMessage: mocks.captureMessage,
    })),
);

vi.mock('i18n', () => ({
    i18n: {
        t: (key: string) => key,
    },
}));

vi.mock('helpers/appUpdate', () => ({
    updateServiceWorker: mocks.updateServiceWorker,
    checkForServiceWorkerUpdate: mocks.checkForServiceWorkerUpdate,
    reloadApp: mocks.reloadApp,
}));

import { GlobalErrorBoundary } from './index';

const CRASH_MESSAGE = 'provider crashed';

const CrashingChild = () => {
    throw new Error(CRASH_MESSAGE);
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateServiceWorker.mockResolvedValue(undefined);
    mocks.checkForServiceWorkerUpdate.mockResolvedValue(false);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.history.replaceState({}, '', '/groups/current');
});

test('renders only the mockup actions inside the shared background without providers', () => {
    const { container } = render(
        <GlobalErrorBoundary>
            <CrashingChild />
        </GlobalErrorBoundary>,
    );

    const fallback = screen.getByRole('alert');

    expect(container.firstElementChild?.contains(fallback)).toBe(true);
    expect(container.firstElementChild).not.toBe(fallback);
    expect(screen.getByRole('heading', { name: 'errorBoundary.title' })).toBeTruthy();
    expect(screen.getByText('errorBoundary.runtimeError')).toBeTruthy();
    expect(screen.queryByText('errorBoundary.subtitle')).toBeNull();
    expect(screen.getByRole('button', { name: 'errorBoundary.tryAgain' })).toBeTruthy();
    expect(
        screen.getByRole('link', { name: 'errorBoundary.goToDashboard' }).getAttribute('href'),
    ).toBe(ROUTES.DASHBOARD);
    expect(screen.queryByText(CRASH_MESSAGE)).toBeNull();
    expect(screen.queryByText(APP_VERSION)).toBeNull();
    expect(screen.queryByText('buttons.copyReport')).toBeNull();
    expect(screen.queryByText('errorBoundary.or')).toBeNull();
    expect(screen.queryByRole('button', { name: 'errorBoundary.updateApp' })).toBeNull();
});

test('reloads the current page once when Try again is clicked repeatedly', () => {
    const user = userEvent.setup();

    render(
        <GlobalErrorBoundary>
            <CrashingChild />
        </GlobalErrorBoundary>,
    );

    const tryAgain = screen.getByRole('button', { name: 'errorBoundary.tryAgain' });

    return user
        .click(tryAgain)
        .then(() => user.click(tryAgain))
        .then(() => {
            // M1: the open draft may be what crashed, so it is not saved for after the reload.
            expect(mocks.reloadApp).toHaveBeenCalledExactlyOnceWith({ keepDraft: false });
            expect(tryAgain.hasAttribute('disabled')).toBe(true);
            expect(mocks.captureMessage).toHaveBeenCalledWith(
                'Application recovery action',
                expect.objectContaining({
                    extra: {
                        action: 'manual-reload',
                        appVersion: APP_VERSION,
                        errorTimestamp: expect.any(String),
                    },
                }),
            );
        });
});

test('shows the update section only when an update is available', () => {
    mocks.checkForServiceWorkerUpdate.mockResolvedValue(true);

    render(
        <GlobalErrorBoundary>
            <CrashingChild />
        </GlobalErrorBoundary>,
    );

    return screen.findByRole('button', { name: 'errorBoundary.updateApp' }).then(updateButton => {
        expect(updateButton).toBeTruthy();
        expect(screen.getByText('errorBoundary.or')).toBeTruthy();
    });
});

// Spec 04 §2.11 (A-26): the fallback applies the update through the single path of
// `ServiceWorkerManager` (`updateServiceWorker(true)`), which reloads once the new worker controls.
test('applies the available update through updateServiceWorker(true) without the draft', () => {
    mocks.checkForServiceWorkerUpdate.mockResolvedValue(true);
    mocks.updateServiceWorker.mockReturnValue(new Promise<void>(() => undefined));
    const user = userEvent.setup();

    render(
        <GlobalErrorBoundary>
            <CrashingChild />
        </GlobalErrorBoundary>,
    );

    return screen.findByRole('button', { name: 'errorBoundary.updateApp' }).then(updateButton =>
        user
            .click(updateButton)
            .then(() => user.click(updateButton))
            .then(() => {
                expect(mocks.updateServiceWorker).toHaveBeenCalledExactlyOnceWith(true, {
                    keepDraft: false,
                });
                expect(mocks.reloadApp).not.toHaveBeenCalled();
                expect(updateButton.hasAttribute('disabled')).toBe(true);
                expect(updateButton.textContent).toContain('errorBoundary.updatingApp');
                expect(
                    screen
                        .getByRole('link', { name: 'errorBoundary.goToDashboard' })
                        .getAttribute('aria-disabled'),
                ).toBe('true');
                expect(mocks.captureMessage).toHaveBeenCalledWith(
                    'Application recovery action',
                    expect.objectContaining({
                        extra: expect.objectContaining({ action: 'update-applied' }),
                    }),
                );
            }),
    );
});

test('hides the update section when the update check fails', () => {
    mocks.checkForServiceWorkerUpdate.mockRejectedValue(new Error('offline'));

    render(
        <GlobalErrorBoundary>
            <CrashingChild />
        </GlobalErrorBoundary>,
    );

    return vi
        .waitFor(() => {
            expect(mocks.checkForServiceWorkerUpdate).toHaveBeenCalledOnce();
        })
        .then(() => {
            expect(screen.queryByText('errorBoundary.or')).toBeNull();
            expect(screen.queryByRole('button', { name: 'errorBoundary.updateApp' })).toBeNull();
        });
});

test('reloads even when action diagnostics cannot be reported', () => {
    mocks.captureMessage.mockImplementation(() => {
        throw new Error('telemetry unavailable');
    });
    const user = userEvent.setup();

    render(
        <GlobalErrorBoundary>
            <CrashingChild />
        </GlobalErrorBoundary>,
    );

    return user.click(screen.getByRole('button', { name: 'errorBoundary.tryAgain' })).then(() => {
        expect(mocks.reloadApp).toHaveBeenCalledOnce();
    });
});

test('does not automatically reload when the same crash renders again', () => {
    const firstRender = render(
        <GlobalErrorBoundary>
            <CrashingChild />
        </GlobalErrorBoundary>,
    );

    firstRender.unmount();

    render(
        <GlobalErrorBoundary>
            <CrashingChild />
        </GlobalErrorBoundary>,
    );

    expect(mocks.reloadApp).not.toHaveBeenCalled();
    expect(mocks.updateServiceWorker).not.toHaveBeenCalled();
});
