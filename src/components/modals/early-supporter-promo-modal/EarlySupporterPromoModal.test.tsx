import { focusManager, onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import { usersKeys } from 'entities/users';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { useUsersStore } from 'store/users-store';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import { EarlySupporterPromoModal } from './EarlySupporterPromoModal';

import 'test/selfUserMirror';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: {
            language: 'en',
            resolvedLanguage: 'en',
        },
        t: (key: string, options?: { date?: string; position?: string; total?: string }) => {
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
            if (key === 'promo.position') {
                return `You’re #${options?.position ?? ''} of ${options?.total ?? ''}`;
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

const server = setupMswServer();

/** Serves `GET /users/premium-promo` (`failed`: a 500, `pending`: never answers). */
const servePromo = (promo: number | 'failed' | 'pending'): { count: number } => {
    const counter = { count: 0 };

    server.use(
        http.get('*/users/premium-promo', () => {
            counter.count += 1;
            if (promo === 'pending') {
                return new Promise<never>(() => undefined);
            }
            return promo === 'failed'
                ? HttpResponse.json({}, { status: 500 })
                : HttpResponse.json({ premiumPromoRemaining: promo });
        }),
    );
    return counter;
};

/** `promo`: a counter already in `users.premiumPromo`, or how the request on the user client ends. */
const setSession = (
    isNewUser: boolean | null,
    user: SelfUser | null,
    promo: number | 'failed' | 'pending' = 417,
) => {
    mountAsUserClient();
    if (typeof promo === 'number') {
        getDefaultTestQueryClient().setQueryData(usersKeys.premiumPromo(), promo);
    } else {
        servePromo(promo);
    }
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
    useUsersStore.setState({ localUser: null, user: null });
    useAuthStore.setState({
        isNewUser: null,
        status: 'unauthenticated',
        unauthReason: 'missing',
    });
    useConnectivityStore.setState({ mode: 'online' });
});

test('shows the promo for a newly registered user with backend Premium', () => {
    const subscriptionUntil = Math.floor(Date.UTC(2027, 8, 13, 12) / 1000);
    setSession(true, createUser('new-user', subscriptionUntil), 417);

    render(<EarlySupporterPromoModal />);

    const expectedDate = new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date(subscriptionUntil * 1000));

    expect(screen.getByRole('dialog', { name: 'Welcome to ChipIn' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'You’re #4,583 of 5,000' })).toBeTruthy();
    expect(screen.getByText(`Expires on ${expectedDate}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thank you' })).toBeTruthy();
});

test('renders the first promo position from the remaining counter', () => {
    setSession(true, createUser('first-promo-user', 1_820_000_000), 4_999);

    render(<EarlySupporterPromoModal />);

    expect(screen.getByRole('heading', { name: 'You’re #1 of 5,000' })).toBeTruthy();
});

test('falls back to the generic first-5,000 copy when the counter is unavailable', async () => {
    setSession(true, createUser('fallback-user', 1_820_000_000), 'failed');

    render(<EarlySupporterPromoModal />);

    expect(await screen.findByRole('heading', { name: 'You’re #1–5,000' })).toBeTruthy();
});

test('waits for the promo counter request before opening the modal', async () => {
    setSession(true, createUser('pending-counter-user', 1_820_000_000), 'pending');

    render(<EarlySupporterPromoModal />);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(screen.queryByRole('dialog')).toBeNull();
});

test("requests the counter once for a new user, on the user's client", async () => {
    mountAsUserClient();
    const requests = servePromo(4_999);
    act(() => {
        useAuthStore.setState({ isNewUser: true, status: 'authenticated' });
        useUsersStore.setState({ user: createUser('requesting-user', 1_820_000_000) });
    });

    render(<EarlySupporterPromoModal />);

    expect(await screen.findByRole('heading', { name: 'You’re #1 of 5,000' })).toBeTruthy();
    expect(requests.count).toBe(1);
    // Never persisted (spec 03 §1.4).
    expect(
        getDefaultTestQueryClient().getQueryCache().find({ queryKey: usersKeys.premiumPromo() })
            ?.meta,
    ).toEqual({ persist: false });
});

test('requests the counter once per session: no focus, reconnect or post-dismissal reload', async () => {
    const user = userEvent.setup();
    mountAsUserClient();
    const requests = servePromo(417);
    act(() => {
        useAuthStore.setState({ isNewUser: true, status: 'authenticated' });
        useUsersStore.setState({ user: createUser('once-user', 1_820_000_000) });
    });
    render(<EarlySupporterPromoModal />);
    await screen.findByRole('dialog', { name: 'Welcome to ChipIn' });
    const client = getDefaultTestQueryClient();
    // Stale, then a focus and a reconnect: neither reloads it.
    client.setQueryData(usersKeys.premiumPromo(), 417, { updatedAt: 0 });

    act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
    });
    await user.click(screen.getByRole('button', { name: 'Thank you' }));
    // Dismissed: the query is disabled, an invalidation sends nothing.
    await act(() => client.invalidateQueries({ queryKey: usersKeys.premiumPromo() }));
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(requests.count).toBe(1);
    focusManager.setFocused(undefined);
});

test.each([
    { name: 'for an existing user', isNewUser: false, userClient: true, signedIn: true },
    { name: 'signed out', isNewUser: true, userClient: true, signedIn: false },
    { name: 'on a client without persistence', isNewUser: true, userClient: false, signedIn: true },
])(
    'sends no counter request and shows nothing $name',
    async ({ isNewUser, userClient, signedIn }) => {
        if (userClient) {
            mountAsUserClient();
        }
        const requests = servePromo(417);
        act(() => {
            useAuthStore.setState({
                isNewUser,
                status: signedIn ? 'authenticated' : 'unauthenticated',
            });
            useUsersStore.setState({ user: createUser('quiet-user', 1_820_000_000) });
        });

        render(<EarlySupporterPromoModal />);

        await new Promise(resolve => setTimeout(resolve, 10));
        expect(requests.count).toBe(0);
        expect(screen.queryByRole('dialog')).toBeNull();
    },
);

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

test('shows promo position #5,000 for the final eligible registration', () => {
    setSession(true, createUser('final-eligible-user', 1_820_000_000), 0);

    render(<EarlySupporterPromoModal />);

    expect(screen.getByRole('dialog', { name: 'Welcome to ChipIn' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'You’re #5,000 of 5,000' })).toBeTruthy();
});

test('dismisses the promo for the current registration and allows a later registration', () => {
    const user = userEvent.setup();
    setSession(true, createUser('first-new-user', 1_820_000_000));

    render(<EarlySupporterPromoModal />);

    return user.click(screen.getByRole('button', { name: 'Thank you' })).then(() => {
        expect(screen.queryByRole('dialog')).toBeNull();

        setSession(true, createUser('second-new-user', 1_830_000_000));

        // The new user reaches the self query on its next notify.
        return screen.findByRole('dialog', { name: 'Welcome to ChipIn' });
    });
});

test('dismisses the promo from the shared close control', () => {
    const user = userEvent.setup();
    setSession(true, createUser('close-control-user', 1_820_000_000));

    render(<EarlySupporterPromoModal />);

    return user.click(screen.getByRole('button', { name: 'Close' })).then(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});

test('suppresses the promo while the backend unavailable fallback is active', () => {
    setSession(true, createUser('backend-unavailable-user', 1_820_000_000));

    render(<EarlySupporterPromoModal />);

    expect(screen.getByRole('dialog', { name: 'Welcome to ChipIn' })).toBeTruthy();

    act(() => {
        useConnectivityStore.setState({ mode: 'backend-down' });
    });

    expect(screen.queryByRole('dialog')).toBeNull();
});
