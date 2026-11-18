// Spec 03 §1.5 row `signOut()` (03-16a part C): the sign-out of a button asks before it deletes
// unsent operations. The count itself is `hooks/unsentOpsConfirm.test.ts`.
import { Theme } from '@radix-ui/themes';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { i18n } from 'i18n';
import { useAuthStore } from 'store/authStore';

import { useSignOutConfirm } from './index';

const count = vi.hoisted(() => ({
    read: vi.fn<() => Promise<{ userId: string | undefined; count: number | null }>>(),
}));

vi.mock('hooks/unsentOpsConfirm', async importOriginal => ({
    ...(await importOriginal<typeof import('hooks/unsentOpsConfirm')>()),
    readSignOutOutboxCount: count.read,
}));

const SIGN_OUT = 'Sign out';

const SignOutButton = () => {
    const { requestSignOut, dialog } = useSignOutConfirm();

    return (
        <>
            <button type="button" onClick={requestSignOut}>
                {SIGN_OUT}
            </button>
            {dialog}
        </>
    );
};

const signOut = vi.fn(() => Promise.resolve());
const realSignOut = useAuthStore.getState().signOut;

beforeEach(() => {
    signOut.mockClear();
    count.read.mockReset();
    useAuthStore.setState({ signOut });
});

afterEach(async () => {
    vi.unstubAllEnvs();
    useAuthStore.setState({ signOut: realSignOut });
    await i18n.changeLanguage('en');
});

const renderButton = () => render(<SignOutButton />, { wrapper: Theme });

const clickSignOut = () => userEvent.setup().click(screen.getByRole('button', { name: SIGN_OUT }));

test('flag off = master: signs out on the click, synchronously, no count read, no dialog', () => {
    renderButton();

    act(() => {
        screen.getByRole('button', { name: SIGN_OUT }).click();
    });

    expect(signOut).toHaveBeenCalledOnce();
    expect(count.read).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
});

describe('flag on', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    });

    test('N = 0: signs out without asking', async () => {
        count.read.mockResolvedValue({ userId: undefined, count: 0 });
        renderButton();
        await clickSignOut();

        await waitFor(() => {
            expect(signOut).toHaveBeenCalledOnce();
        });
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    test('N > 0: "N unsent operations will be deleted. Sign out?"; Cancel keeps the session', async () => {
        count.read.mockResolvedValue({ userId: undefined, count: 3 });
        renderButton();
        await clickSignOut();
        const dialog = await screen.findByRole('alertdialog');

        expect(dialog.textContent).toContain('3 unsent operations will be deleted. Sign out?');
        await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() => {
            expect(screen.queryByRole('alertdialog')).toBeNull();
        });
        expect(signOut).not.toHaveBeenCalled();
    });

    test('N > 0, confirmed: signs out', async () => {
        count.read.mockResolvedValue({ userId: undefined, count: 1 });
        renderButton();
        await clickSignOut();
        const dialog = await screen.findByRole('alertdialog');

        expect(dialog.textContent).toContain('1 unsent operation will be deleted. Sign out?');
        await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Sign Out' }));

        await waitFor(() => {
            expect(signOut).toHaveBeenCalledOnce();
        });
    });

    test('N2: the tab user changed while counting: nothing happens', async () => {
        count.read.mockResolvedValue({ userId: 'someone-else', count: 0 });
        renderButton();
        await clickSignOut();
        await act(() => new Promise(resolve => setTimeout(resolve, 20)));

        expect(signOut).not.toHaveBeenCalled();
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    test('a failed count: the confirm without a number', async () => {
        count.read.mockResolvedValue({ userId: undefined, count: null });
        renderButton();
        await clickSignOut();

        expect((await screen.findByRole('alertdialog')).textContent).toContain(
            'Unsent operations of this device may be deleted. Sign out?',
        );
        expect(signOut).not.toHaveBeenCalled();
    });

    test.each([
        [2, '2 неотправленные операции будут удалены. Выйти?'],
        [5, '5 неотправленных операций будут удалены. Выйти?'],
    ])('ru plural, %i', async (n, text) => {
        await act(() => i18n.changeLanguage('ru'));
        count.read.mockResolvedValue({ userId: undefined, count: n });
        renderButton();
        await clickSignOut();

        expect((await screen.findByRole('alertdialog')).textContent).toContain(text);
    });
});
