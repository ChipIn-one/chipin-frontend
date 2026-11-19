// Spec 04 §2.3 (C3-09), review R1 of 04-2a2b: an expiry hides the overlays the page opened too.
// Radix dialogs and sheets are portaled to `<body>`, outside the hidden page container; the real
// `AuthModal` (portaled as well) must stay visible and focusable.
import { Dialog, Theme } from '@radix-ui/themes';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useAuthStore } from 'store/authStore';

import { AuthLayout } from './AuthLayout';

vi.mock('assets/google-icon.svg?react', () => ({
    default: () => <svg aria-hidden="true" />,
}));

const SETTLE_TITLE = 'Settle up';
const SETTLE_ACTION = 'Pay 25.00';

/** A page that has a dialog open (as the settle-up flow of the group page). */
const PageWithDialog = () => (
    <Dialog.Root defaultOpen>
        <Dialog.Content aria-describedby={undefined}>
            <Dialog.Title>{SETTLE_TITLE}</Dialog.Title>
            <button type="button">{SETTLE_ACTION}</button>
        </Dialog.Content>
    </Dialog.Root>
);

let router: ReturnType<typeof createMemoryRouter> | null = null;

const portalOf = (element: Element): Element | null => {
    let node: Element | null = element;

    while (node?.parentElement && node.parentElement !== document.body) {
        node = node.parentElement;
    }
    return node;
};

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
});

afterEach(() => {
    router?.dispose();
    router = null;
});

test('an expiry hides and disables the dialog the page opened; sign-in brings it back', () => {
    router = createMemoryRouter(
        [
            {
                element: <AuthLayout />,
                children: [{ path: '/group/:groupId', element: <PageWithDialog /> }],
            },
        ],
        { initialEntries: ['/group/x'] },
    );
    render(
        <Theme>
            <RouterProvider router={router} />
        </Theme>,
    );
    const pageDialog = screen.getByRole('dialog', { name: SETTLE_TITLE });
    const pagePortal = portalOf(pageDialog);
    expect(pagePortal?.parentElement).toBe(document.body);

    act(() => {
        useAuthStore.getState().expireSession();
    });

    // The page dialog stays mounted (its state survives), but invisible and inert.
    expect(pageDialog.isConnected).toBe(true);
    expect(pagePortal?.hasAttribute('data-auth-hidden-portal')).toBe(true);
    expect(pagePortal && getComputedStyle(pagePortal).visibility).toBe('hidden');
    expect(pageDialog.closest('[inert]')).not.toBeNull();
    // The auth modal is another portal: visible, not inert, and it holds the focus.
    const authDialog = screen
        .getAllByRole('dialog', { hidden: true })
        .find(dialog => dialog !== pageDialog);
    expect(authDialog).toBeDefined();
    const authPortal = authDialog ? portalOf(authDialog) : null;
    expect(authPortal).not.toBe(pagePortal);
    expect(authPortal?.hasAttribute('data-auth-hidden-portal')).toBe(false);
    expect(authDialog?.closest('[inert]')).toBeNull();
    expect(pagePortal?.contains(document.activeElement)).toBe(false);

    act(() => {
        useAuthStore.getState().setAuthenticated();
    });

    expect(screen.getByRole('dialog', { name: SETTLE_TITLE })).toBe(pageDialog);
    expect(pagePortal?.hasAttribute('data-auth-hidden-portal')).toBe(false);
    expect(pageDialog.closest('[inert]')).toBeNull();
    expect(pagePortal && getComputedStyle(pagePortal).visibility).not.toBe('hidden');
    expect(screen.getByRole('button', { name: SETTLE_ACTION })).toBeTruthy();
});
