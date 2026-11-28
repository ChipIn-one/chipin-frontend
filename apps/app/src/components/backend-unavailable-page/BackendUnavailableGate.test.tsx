import { Dialog, Theme } from '@radix-ui/themes';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';

import { i18n } from 'i18n';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';

import { BackendUnavailableGate } from './index';

const CONFIRMED_CLIENT_STATE = 'Confirmed client state';
const PRESERVED_ACTION_LABEL = 'Preserved action';
const PAGE_DIALOG_TITLE = 'Settle up';

beforeEach(() => {
    useConnectivityStore.setState({ mode: 'online' });
    useAuthStore.setState({
        status: 'authenticated',
        unauthReason: undefined,
        isNewUser: false,
    });
});

test('keeps existing app content and session state mounted while showing the fallback', () => {
    useConnectivityStore.setState({ mode: 'backend-down' });

    render(
        <BackendUnavailableGate>
            <div>{CONFIRMED_CLIENT_STATE}</div>
        </BackendUnavailableGate>,
    );

    expect(screen.getByText(CONFIRMED_CLIENT_STATE)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(useAuthStore.getState().status).toBe('authenticated');
});

test('makes the preserved app subtree inert while unavailable and interactive after recovery', () => {
    useConnectivityStore.setState({ mode: 'backend-down' });

    render(
        <BackendUnavailableGate>
            <button type="button">{PRESERVED_ACTION_LABEL}</button>
        </BackendUnavailableGate>,
    );

    const appContent = screen.getByText(PRESERVED_ACTION_LABEL).parentElement;

    expect(appContent?.hasAttribute('inert')).toBe(true);

    act(() => {
        useConnectivityStore.setState({ mode: 'online' });
    });

    expect(appContent?.hasAttribute('inert')).toBe(false);
});

test('does not block the app while offline', () => {
    useConnectivityStore.setState({ mode: 'offline' });

    render(
        <BackendUnavailableGate>
            <button type="button">{PRESERVED_ACTION_LABEL}</button>
        </BackendUnavailableGate>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(PRESERVED_ACTION_LABEL).parentElement?.hasAttribute('inert')).toBe(
        false,
    );
});

test('NET-005 keeps the backend-unavailable screen on top of an open dialog', async () => {
    render(
        <Theme>
            <BackendUnavailableGate>
                <Dialog.Root defaultOpen>
                    <Dialog.Content aria-describedby={undefined}>
                        <Dialog.Title>{PAGE_DIALOG_TITLE}</Dialog.Title>
                        <button type="button">{PRESERVED_ACTION_LABEL}</button>
                    </Dialog.Content>
                </Dialog.Root>
            </BackendUnavailableGate>
        </Theme>,
    );
    const pageDialog = screen.getByRole('dialog', { name: PAGE_DIALOG_TITLE });
    await waitFor(() => expect(pageDialog.contains(document.activeElement)).toBe(true));

    act(() => {
        useConnectivityStore.setState({ mode: 'backend-down' });
    });

    const tryAgain = screen.getByRole('button', {
        name: i18n.t('errors:backendUnavailable.tryAgain'),
    });
    // The outage screen takes the focus; the earlier dialog is hidden from it and stays mounted.
    await waitFor(() => expect(document.activeElement).toBe(tryAgain));
    expect(pageDialog.isConnected).toBe(true);
    expect(pageDialog.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(tryAgain.closest('[aria-hidden="true"], [inert]')).toBeNull();
    // Only the top modal layer takes pointer input.
    expect(pageDialog.style.pointerEvents).toBe('none');
    expect(tryAgain.closest<HTMLElement>('[role="dialog"]')?.style.pointerEvents).toBe('auto');
    // Painted later in the DOM than the earlier dialog, at the same (auto) layer.
    const outageDialog = tryAgain.closest('[role="dialog"]');
    expect(
        outageDialog &&
            pageDialog.compareDocumentPosition(outageDialog) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
});
