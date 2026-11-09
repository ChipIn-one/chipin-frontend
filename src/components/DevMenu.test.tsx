import { Theme } from '@radix-ui/themes';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { saveLocalUser } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import DevMenu from './DevMenu';

const theme = vi.hoisted(() => ({
    resolvedTheme: 'light',
    setTheme: vi.fn(),
}));

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'light',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies UserSettings;

vi.mock('next-themes', () => ({
    useTheme: () => theme,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({ children }: { children: ReactNode }) => children,
}));

const server = setupMswServer();
let patches: unknown[] = [];

beforeEach(() => {
    vi.clearAllMocks();
    theme.resolvedTheme = 'light';
    useAuthStore.setState({ status: 'unauthenticated' });
    saveLocalUser({ id: 'user-1', role: 'ADMIN', settings });
    patches = [];
    server.use(
        http.patch('*/users/self', async ({ request }) => {
            patches.push(await request.json());
            return HttpResponse.json({ code: 'SYSTEM.INTERNAL' }, { status: 400 });
        }),
    );
});

test('switches the local theme without saving user settings on the landing page', () => {
    const user = userEvent.setup();

    render(
        <Theme>
            <DevMenu />
        </Theme>,
    );

    return user
        .click(screen.getByRole('button', { name: 'header.devMenu' }))
        .then(() => user.click(screen.getByRole('menuitem', { name: 'header.switchTheme' })))
        .then(() => {
            expect(theme.setTheme).toHaveBeenCalledWith('dark');
            expect(patches).toEqual([]);
        });
});

test('persists the theme while an authenticated user is still loading', () => {
    const user = userEvent.setup();
    useAuthStore.setState({ status: 'authenticated' });
    mountAsUserClient();

    render(
        <Theme>
            <DevMenu />
        </Theme>,
    );

    return user
        .click(screen.getByRole('button', { name: 'header.devMenu' }))
        .then(() => user.click(screen.getByRole('menuitem', { name: 'header.switchTheme' })))
        .then(() =>
            waitFor(() => {
                expect(patches).toEqual([{ settings: { theme: 'dark' } }]);
                expect(theme.setTheme).not.toHaveBeenCalled();
            }),
        );
});
