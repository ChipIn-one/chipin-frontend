import { Dialog, Theme } from '@radix-ui/themes';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, expect, test, vi } from 'vitest';

import { resetUpdateRequiredForTests, showUpdateRequired } from 'app/pwa/updateRequired';
import { i18n } from 'i18n';
import { useConnectivityStore } from 'store/connectivityStore';

import { BackendUnavailableGate } from 'components/backend-unavailable-page';
import { BaseModal } from 'components/modals/base-modal';

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

const findToaster = () =>
    waitFor(() => {
        const element = document.querySelector('[data-sonner-toaster]');

        expect(element).not.toBeNull();
        return element;
    });

afterEach(() => {
    document.getElementById('root')?.remove();
    resetUpdateRequiredForTests();
    toast.dismiss();
    useConnectivityStore.setState({ mode: 'online' });
});

test("NET-003 renders the toaster outside the root theme, where dialog portals can't cover it", async () => {
    useConnectivityStore.setState({ mode: 'backend-down' });
    render(<Shell />);

    act(() => {
        toast.error('Save failed');
    });
    const toaster = await findToaster();

    // Not in the `z-index: 0` stacking context of the root theme, nor in the inert app content.
    expect(toaster?.closest('[data-is-root-theme="true"]')).toBeNull();
    expect(toaster?.closest('[inert]')).toBeNull();
    // Without an app root container the layer falls back to a direct child of `<body>`.
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

test('NET-003 portals the layer into the app root container, next to the root theme', async () => {
    const appRoot = document.createElement('div');
    appRoot.id = 'root';
    document.body.append(appRoot);
    render(<Shell />, { container: appRoot });

    act(() => {
        toast('Saved');
    });
    const layer = (await findToaster())?.closest('.radix-themes');

    expect(layer?.getAttribute('data-is-root-theme')).toBe('false');
    expect(layer?.parentElement).toBe(appRoot);
    expect(appRoot.querySelector(':scope > [data-is-root-theme="true"]')).not.toBeNull();
});

test('NET-003 a pointerdown on a toast does not close an open modal', async () => {
    const setIsOpened = vi.fn();
    render(
        <Theme>
            <BaseModal
                isOpened
                setIsOpened={setIsOpened}
                title={DIALOG_TITLE}
                accessibleDescription={DIALOG_TITLE}
                content={null}
            />
            <TopLayer />
        </Theme>,
    );
    act(() => {
        toast('Saved');
    });
    const toastElement = await waitFor(() => {
        const element = document.querySelector('[data-sonner-toast]');

        expect(element).not.toBeNull();
        return element;
    });
    // Radix starts listening for outside pointerdowns one tick after the dialog mounts.
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));

    if (toastElement) {
        fireEvent.pointerDown(toastElement);
    }
    expect(setIsOpened).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: DIALOG_TITLE })).toBeTruthy();

    // Control: a pointerdown elsewhere outside the modal still closes it.
    fireEvent.pointerDown(document.body);
    expect(setIsOpened).toHaveBeenCalledWith(false);
});

test('renders the update-required screen last in the layer, above the toasts', async () => {
    render(<Shell />);
    act(() => {
        showUpdateRequired();
        toast('Saved');
    });
    const layer = (await findToaster())?.closest('.radix-themes');
    const updateScreen = screen.getByRole('alertdialog');

    expect(updateScreen.closest('.radix-themes')).toBe(layer);
    expect(layer?.lastElementChild?.contains(updateScreen)).toBe(true);
});
