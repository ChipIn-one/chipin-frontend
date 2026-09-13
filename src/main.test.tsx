import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { SelfUser } from 'api/chipin.types';
import i18n from 'i18n';
import { useUsersStore } from 'store/users-store';

import Main from './main';

vi.mock('next-themes', () => ({
    useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('hooks/common', () => ({
    useIsMobile: () => false,
}));

vi.mock('components/Header', () => ({ default: () => null }));
vi.mock('components/AddExpenseButton', () => ({ default: () => null }));
vi.mock('basics/PWABadge', () => ({ default: () => null }));
vi.mock('features/routing', () => ({ default: () => null }));
vi.mock('pages/GlobalHooks', () => ({ default: () => null }));
vi.mock('components/backend-unavailable-page', () => ({
    BackendUnavailableGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const premiumUser = {
    id: 'premium-user',
    email: 'premium@example.com',
    displayName: 'Premium User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    isPremium: true,
    premiumExpiresAt: 1_799_971_200,
    inviteToken: 'premium-invite-token',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'other',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

beforeEach(() => {
    localStorage.clear();
    void i18n.changeLanguage('en');
    useUsersStore.setState({ user: premiumUser });
});

afterEach(() => {
    useUsersStore.getState().setInitialUsersStore();
    localStorage.clear();
});

test('shows the first-5000 Premium launch promo with the backend expiration date', () => {
    render(<Main />);

    expect(screen.getByText("You're one of the first 5,000 ChipIn users.")).toBeTruthy();
    expect(screen.getByText('Premium is yours free for 1 year.')).toBeTruthy();
    expect(screen.getByText(/January 15, 2027/)).toBeTruthy();
});
