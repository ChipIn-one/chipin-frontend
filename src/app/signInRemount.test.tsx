// Spec 03 §1.5: the first `LocalUser.id` after boot (a fresh sign-in, or the first `fetchSetUser`
// for a stored user written before 03-7a) remounts the app on that user's client. The remounted
// sign-in check must not refresh the session, and the callback page must not exchange the code, twice.
import { useEffect } from 'react';
import { Theme } from '@radix-ui/themes';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { get } from 'idb-keyval';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import type { SelfUser } from 'api/chipin.types';
import { usePersistedUserId } from 'app/providers/persistedUserId';
import { UserQueryProvider } from 'app/providers/UserQueryProvider';
import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { establishAuthSession } from 'helpers/authSession';
import { hasAuthSessionHint, LocalStorage, saveLocalUser } from 'helpers/localStorage';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
import { OAuthCallbackPage } from 'pages/oauth-callback-page';
import { clientFor } from 'shared/offline/restore';
import { useAuthStore } from 'store/authStore';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/users-store';
import { fakeAccessToken } from 'test/fakeAccessToken';

import { RestoreGate } from './providers/RestoreGate';

import 'fake-indexeddb/auto';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock('api/chipin', () => ({ exchangeApiGoogleOAuthCode: vi.fn() }));
vi.mock('helpers/authSession', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/authSession')>()),
    establishAuthSession: vi.fn(),
}));
vi.mock('basics/PageLoader', () => ({ default: () => null }));
vi.mock('idb-keyval', async importOriginal => {
    const actual = await importOriginal<typeof import('idb-keyval')>();

    return { ...actual, get: vi.fn(actual.get) };
});

const user = {
    id: 'signed-in-user',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
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

const SignInCheck = () => {
    useCheckSignIn();
    return null;
};

let mounts = 0;
const MountCounter = () => {
    useEffect(() => {
        mounts += 1;
    }, []);
    return null;
};

const clients: QueryClient[] = [];
const ClientProbe = () => {
    clients.push(useQueryClient());
    return null;
};
const currentClient = (): QueryClient | undefined => clients[clients.length - 1];

const DESTINATION_TEXT = 'destination';
const Destination = () => <p>{DESTINATION_TEXT}</p>;

// What main.tsx does: the provider follows `localUser.id` from the users store, the router is
// inside it (a MemoryRouter even restarts at its initial entry on the remount).
const App = ({ initialEntry = '/' }: { initialEntry?: string }) => {
    const userId = usePersistedUserId();

    return (
        <Theme>
            <UserQueryProvider userId={userId}>
                <MemoryRouter initialEntries={[initialEntry]}>
                    <RestoreGate>
                        <MountCounter />
                        <ClientProbe />
                        <SignInCheck />
                        <Routes>
                            <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
                            <Route path="*" element={<Destination />} />
                        </Routes>
                    </RestoreGate>
                </MemoryRouter>
            </UserQueryProvider>
        </Theme>
    );
};

const mockSignedInFetches = (id: string) => {
    vi.spyOn(useDashboardStore.getState(), 'fetchSetDashboardData').mockResolvedValue();
    vi.spyOn(useGroupsStore.getState(), 'fetchSetGroups').mockResolvedValue([]);
    vi.spyOn(useUsersStore.getState(), 'fetchSetFriends').mockResolvedValue();
    return vi.spyOn(useUsersStore.getState(), 'fetchSetUser').mockImplementation(() => {
        // As the real action: `saveLocalUser(toLocalUser(user))` and `localUser` in the store.
        saveLocalUser({ id, role: user.role, settings: user.settings });
        useUsersStore.setState({
            user: { ...user, id },
            localUser: { id, settings: user.settings },
        });
        return Promise.resolve({ ...user, id });
    });
};

beforeEach(() => {
    mounts = 0;
    clients.length = 0;
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
    // A user cached before 03-7a: settings, no id.
    LocalStorage.remove(LS_KEY_USER);
    saveLocalUser({ role: 'USER', settings: user.settings });
    useUsersStore.getState().setInitialUsersStore();
    useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
});

test('the first id after boot: one session refresh, then the user client with its restore', async () => {
    const refresh = vi
        .spyOn(useAuthStore.getState(), 'refreshAuthTokens')
        .mockImplementation(() => {
            useAuthStore.setState({ status: 'authenticated' });
            return Promise.resolve('access-token');
        });
    const fetchSetUser = mockSignedInFetches('stored-user');

    render(<App />);

    await waitFor(() => {
        expect(get).toHaveBeenCalledWith('chipin:rq:stored-user');
    });
    await waitFor(() => {
        // Mounted on the anonymous client, then remounted on the user's client.
        expect(mounts).toBe(2);
    });

    // The remounted check sees `authenticated` and does not run again.
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchSetUser).toHaveBeenCalledOnce();
});

// `establishAuthSession` is mocked; like the real one it writes the session hint.
const establishWritesHint = () => {
    vi.mocked(establishAuthSession).mockImplementation(() => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
    });
};

test('a fresh OAuth sign-in: the remounted callback page does not exchange the code twice', async () => {
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, false);
    establishWritesHint();
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'missing' });
    LocalStorage.remove(LS_KEY_USER);
    useUsersStore.getState().setInitialUsersStore();
    vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
        token: 'access-token',
        is_new_user: false,
    });
    const refresh = vi.spyOn(useAuthStore.getState(), 'refreshAuthTokens');
    const fetchSetUser = mockSignedInFetches('oauth-user');

    render(<App initialEntry="/oauth/callback?code=single-use-code" />);

    expect(await screen.findByText(DESTINATION_TEXT)).not.toBeNull();
    await waitFor(() => {
        expect(get).toHaveBeenCalledWith('chipin:rq:oauth-user');
    });
    // Hint false → true and the first id: one remount onto the user's client.
    expect(mounts).toBe(2);
    expect(currentClient()).toBe(clientFor('oauth-user'));
    expect(exchangeApiGoogleOAuthCode).toHaveBeenCalledOnce();
    expect(fetchSetUser).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('authenticated');
});

test('a cached id without a session hint: no IndexedDB read, no persisted client mounted', async () => {
    LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
    saveLocalUser({ id: 'hintless-user', role: 'USER', settings: user.settings });
    useUsersStore.getState().setInitialUsersStore();
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'missing' });

    render(<App />);

    expect(await screen.findByText(DESTINATION_TEXT)).not.toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(mounts).toBe(1);
});

test('OAuth sign-in of a cached user whose user/friends fetches change nothing: the hint switch alone remounts', async () => {
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, false);
    establishWritesHint();
    saveLocalUser({ id: 'cached-user', role: 'USER', settings: user.settings });
    useUsersStore.getState().setInitialUsersStore();
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'expired' });
    vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
        token: fakeAccessToken('cached-user'),
        is_new_user: false,
    });
    vi.spyOn(useDashboardStore.getState(), 'fetchSetDashboardData').mockResolvedValue();
    vi.spyOn(useGroupsStore.getState(), 'fetchSetGroups').mockResolvedValue([]);
    // The real actions swallow their errors and leave the users store as it is.
    vi.spyOn(useUsersStore.getState(), 'fetchSetUser').mockResolvedValue(null);
    vi.spyOn(useUsersStore.getState(), 'fetchSetFriends').mockResolvedValue();

    render(<App initialEntry="/oauth/callback?code=cached-user-code" />);

    expect(await screen.findByText(DESTINATION_TEXT)).not.toBeNull();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(currentClient()).toBe(clientFor('cached-user'));
    expect(get).toHaveBeenCalledWith('chipin:rq:cached-user');
    expect(exchangeApiGoogleOAuthCode).toHaveBeenCalledOnce();
});

test("expiry: X's client → anonymous; the hint back with the same id → X's memoized client", async () => {
    saveLocalUser({ id: 'expiring-user', role: 'USER', settings: user.settings });
    useUsersStore.getState().setInitialUsersStore();
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });

    render(<App />);
    await screen.findByText(DESTINATION_TEXT);
    const userClient = clientFor('expiring-user');
    expect(currentClient()).toBe(userClient);

    act(() => {
        useAuthStore.getState().expireSession();
    });
    await screen.findByText(DESTINATION_TEXT);

    expect(hasAuthSessionHint()).toBe(false);
    expect(useUsersStore.getState().localUser?.id).toBe('expiring-user');
    expect(currentClient()).not.toBe(userClient);

    act(() => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
    });
    await screen.findByText(DESTINATION_TEXT);

    expect(currentClient()).toBe(userClient);
});
