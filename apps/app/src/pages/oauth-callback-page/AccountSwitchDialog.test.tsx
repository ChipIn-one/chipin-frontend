// Spec 03 §1.5 "sign-in of Y" (03-16a part C): the dialog of the tab that signs Y in over X's
// unsent operations, hosted by the OAuth callback page. The flow itself is
// `store/authStore.accountSwitch.test.ts`.
import { Theme } from '@radix-ui/themes';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import i18n from 'i18n/index';
import {
    requestAccountSwitchConfirm,
    useAccountSwitchConfirmStore,
} from 'store/accountSwitchConfirmStore';
import { useAuthStore } from 'store/authStore';

import { AccountSwitchDialog } from './AccountSwitchDialog';
import { OAuthCallbackPage } from './OAuthCallbackPage';

vi.mock('basics/PageLoader', () => ({
    PageLoader: () => <div data-testid="page-loader" />,
    default: () => <div data-testid="page-loader" />,
}));

const originalExchange = useAuthStore.getState().exchangeGoogleOAuthCode;

beforeEach(() => {
    useAccountSwitchConfirmStore.setState({ request: null });
});

afterEach(async () => {
    vi.unstubAllEnvs();
    useAuthStore.setState({ exchangeGoogleOAuthCode: originalExchange });
    await i18n.changeLanguage('en');
});

const renderDialog = () => render(<AccountSwitchDialog />, { wrapper: Theme });

describe('AccountSwitchDialog', () => {
    test('shows N and resolves "Delete and sign in" as true', async () => {
        renderDialog();
        let answer: Promise<boolean> = Promise.resolve(false);

        act(() => {
            answer = requestAccountSwitchConfirm(2);
        });
        const dialog = await screen.findByRole('alertdialog');

        expect(dialog.textContent).toContain(
            'This device has 2 unsent operations of another account. Delete them and sign in?',
        );
        await userEvent
            .setup()
            .click(within(dialog).getByRole('button', { name: 'Delete and sign in' }));

        await expect(answer).resolves.toBe(true);
        await waitFor(() => {
            expect(screen.queryByRole('alertdialog')).toBeNull();
        });
    });

    test('Cancel resolves false', async () => {
        renderDialog();
        let answer: Promise<boolean> = Promise.resolve(true);

        act(() => {
            answer = requestAccountSwitchConfirm(1);
        });
        const dialog = await screen.findByRole('alertdialog');

        expect(dialog.textContent).toContain(
            'This device has 1 unsent operation of another account. Delete it and sign in?',
        );
        await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Cancel' }));

        await expect(answer).resolves.toBe(false);
    });

    test('a failed count: the question without a number; ru plural', async () => {
        renderDialog();
        act(() => {
            void requestAccountSwitchConfirm(null);
        });
        expect((await screen.findByRole('alertdialog')).textContent).toContain(
            'This device may have unsent operations of another account. Delete them and sign in?',
        );
        await act(() => i18n.changeLanguage('ru'));
        act(() => {
            void requestAccountSwitchConfirm(5);
        });

        await waitFor(() => {
            expect(screen.getByRole('alertdialog').textContent).toContain(
                'На этом устройстве есть 5 неотправленных операций другого аккаунта. Удалить их и войти?',
            );
        });
    });

    test('a newer question answers the unanswered one with false', async () => {
        const first = requestAccountSwitchConfirm(1);

        void requestAccountSwitchConfirm(2);

        await expect(first).resolves.toBe(false);
        expect(useAccountSwitchConfirmStore.getState().request).toEqual({ count: 2 });
    });
});

describe('OAuthCallbackPage hosts the dialog only with offline writes on', () => {
    const renderPage = () => {
        useAuthStore.setState({ exchangeGoogleOAuthCode: () => new Promise(() => undefined) });
        render(
            <MemoryRouter initialEntries={['/oauth/callback?code=abc']}>
                <OAuthCallbackPage />
            </MemoryRouter>,
            { wrapper: Theme },
        );
    };

    test('flag off = master: only the loader, a question renders nothing', () => {
        renderPage();
        act(() => {
            void requestAccountSwitchConfirm(2);
        });

        expect(screen.getByTestId('page-loader')).toBeTruthy();
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    test('flag on: the question of the exchange is shown', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        renderPage();
        act(() => {
            void requestAccountSwitchConfirm(2);
        });

        expect(await screen.findByRole('alertdialog')).toBeTruthy();
    });
});
