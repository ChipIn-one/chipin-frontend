import { Dialog, Theme } from '@radix-ui/themes';
import { act, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, expect, test, vi } from 'vitest';

import { i18n } from 'i18n';
import { useConnectivityStore } from 'store/connectivityStore';

import { BackendUnavailableGate } from 'components/backend-unavailable-page';

import { TopLayer } from './TopLayer';

vi.mock('hooks/common', () => ({ useIsMobile: () => false }));
// The real gate makes the app content inert; its screen is a stub (NET-005 is covered by the gate).
vi.mock('components/backend-unavailable-page/BackendUnavailablePage', () => ({
    BackendUnavailablePage: () => null,
}));

const DIALOG_TITLE = 'Add expense';

/** The shell of RootLayout: app content in the gate (with a portaled dialog), then the top layer. */
const Shell = () => (
    <Theme appearance="dark">
        <BackendUnavailableGate>
            <Dialog.Root defaultOpen>
                <Dialog.Content aria-describedby={undefined}>
                    <Dialog.Title>{DIALOG_TITLE}</Dialog.Title>
                </Dialog.Content>
            </Dialog.Root>
        </BackendUnavailableGate>
        <TopLayer />
    </Theme>
);

const offlineStatusText = () => i18n.t('errors:network.offlineStatus');

afterEach(() => {
    toast.dismiss();
    useConnectivityStore.setState({ mode: 'online' });
});

test("NET-003 renders the toaster outside the root theme, where dialog portals can't cover it", async () => {
    useConnectivityStore.setState({ mode: 'backend-down' });
    render(<Shell />);

    act(() => {
        toast.error('Save failed');
    });
    const toaster = await waitFor(() => {
        const element = document.querySelector('[data-sonner-toaster]');

        expect(element).not.toBeNull();
        return element;
    });

    // Not in the `z-index: 0` stacking context of the root theme, nor in the inert app content.
    expect(toaster?.closest('[data-is-root-theme="true"]')).toBeNull();
    expect(toaster?.closest('[inert]')).toBeNull();
    // A body-level layer: its nested theme is a direct child of `<body>` (no app root in jsdom).
    const layer = toaster?.closest('.radix-themes');
    expect(layer?.getAttribute('data-is-root-theme')).toBe('false');
    expect(layer?.getAttribute('data-has-background')).toBe('false');
    expect(layer?.parentElement).toBe(document.body);
    // The nested theme follows the appearance of the app.
    expect(layer?.classList.contains('dark')).toBe(true);
});

test('NET-004 shows the offline status while offline and hides it online, also with a dialog open', () => {
    render(<Shell />);
    expect(screen.getByRole('dialog', { name: DIALOG_TITLE })).toBeTruthy();
    expect(screen.queryByText(offlineStatusText())).toBeNull();

    act(() => {
        useConnectivityStore.setState({ mode: 'offline' });
    });
    const status = screen.getByText(offlineStatusText()).closest('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.closest('[data-is-root-theme="true"]')).toBeNull();
    // Informational: nothing in it takes focus.
    expect(status?.querySelector('button, a, input, [tabindex]')).toBeNull();
    expect(screen.getByRole('dialog', { name: DIALOG_TITLE })).toBeTruthy();

    act(() => {
        useConnectivityStore.setState({ mode: 'online' });
    });
    expect(screen.queryByText(offlineStatusText())).toBeNull();
});
