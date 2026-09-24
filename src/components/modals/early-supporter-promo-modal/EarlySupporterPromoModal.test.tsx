import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import { useAuthStore } from 'store/authStore';
import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';
import { useUsersStore } from 'store/users-store';

import { EarlySupporterPromoModal } from './EarlySupporterPromoModal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: {
            language: 'en',
            resolvedLanguage: 'en',
        },
        t: (key: string, options?: { date?: string }) => {
            const translations: Record<string, string> = {
                'buttons.close': 'Close',
                'promo.benefit': 'Premium is yours for 1 year — free.',
                'promo.button': 'Thank you',
                'promo.intro': 'Thank you for being with ChipIn early.',
                'promo.label': 'EARLY SUPPORTER',
                'promo.modalTitle': 'Welcome to ChipIn',
                'promo.title': 'You’re #1–5,000',
            };

            if (key === 'promo.expires') {
                return `Expires on ${options?.date ?? ''}`;
            }

            return translations[key] ?? key;
        },
    }),
}));

const createUser = (id: string, subscriptionUntil: number | null): SelfUser => ({
    id,
    email: `${id}@example.com`,
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil,
    inviteToken: 'invite-token-user',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: true,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
});

const setSession = (isNewUser: boolean | null, user: SelfUser | null) => {
    act(() => {
        useAuthStore.setState({
            isNewUser,
            status: user ? 'authenticated' : 'unauthenticated',
            unauthReason: user ? undefined : 'missing',
        });
        useUsersStore.setState({ user });
    });
};

beforeEach(() => {
    vi.clearAllMocks();
    useUsersStore.setState({
        friends: [],
        localUser: null,
        user: null,
    });
    useAuthStore.setState({
        isNewUser: null,
        status: 'unauthenticated',
        unauthReason: 'missing',
    });
    useBackendAvailabilityStore.setState({ isUnavailable: false });
});

test('shows the promo for a newly registered user with backend Premium', () => {
    const subscriptionUntil = Math.floor(Date.UTC(2027, 8, 13, 12) / 1000);
    setSession(true, createUser('new-user', subscriptionUntil));

    render(<EarlySupporterPromoModal />);

    const expectedDate = new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date(subscriptionUntil * 1000));

    expect(screen.getByRole('dialog', { name: 'Welcome to ChipIn' })).toBeTruthy();
    expect(screen.getByText(`Expires on ${expectedDate}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thank you' })).toBeTruthy();
});

test('does not show the promo for an existing user', () => {
    setSession(false, createUser('existing-user', 1_820_000_000));

    render(<EarlySupporterPromoModal />);

    expect(screen.queryByRole('dialog')).toBeNull();
});

test('does not show the promo when a new user did not receive Premium', () => {
    setSession(true, createUser('non-eligible-user', null));

    render(<EarlySupporterPromoModal />);

    expect(screen.queryByRole('dialog')).toBeNull();
});

test('shows the promo for the final eligible registration without using the remaining counter', () => {
    setSession(true, createUser('final-eligible-user', 1_820_000_000));

    render(<EarlySupporterPromoModal />);

    expect(screen.getByRole('dialog', { name: 'Welcome to ChipIn' })).toBeTruthy();
});

test('dismisses the promo for the current registration and allows a later registration', () => {
    const user = userEvent.setup();
    setSession(true, createUser('first-new-user', 1_820_000_000));

    render(<EarlySupporterPromoModal />);

    return user
        .click(screen.getByRole('button', { name: 'Thank you' }))
        .then(() => {
            expect(screen.queryByRole('dialog')).toBeNull();

            setSession(true, createUser('second-new-user', 1_830_000_000));

            expect(screen.getByRole('dialog', { name: 'Welcome to ChipIn' })).toBeTruthy();
        });
});

test('dismisses the promo from the shared close control', () => {
    const user = userEvent.setup();
    setSession(true, createUser('close-control-user', 1_820_000_000));

    render(<EarlySupporterPromoModal />);

    return user
        .click(screen.getByRole('button', { name: 'Close' }))
        .then(() => {
            expect(screen.queryByRole('dialog')).toBeNull();
        });
});

test('suppresses the promo while the backend unavailable fallback is active', () => {
    setSession(true, createUser('backend-unavailable-user', 1_820_000_000));

    render(<EarlySupporterPromoModal />);

    expect(screen.getByRole('dialog', { name: 'Welcome to ChipIn' })).toBeTruthy();

    act(() => {
        useBackendAvailabilityStore.setState({ isUnavailable: true });
    });

    expect(screen.queryByRole('dialog')).toBeNull();
});
