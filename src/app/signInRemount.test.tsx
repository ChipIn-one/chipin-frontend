// Spec 03 §1.5: the first `LocalUser.id` after boot (a fresh sign-in, or the first session load
// for a stored user written before 03-7a) remounts the app on that user's client. The remounted
// sign-in check must not refresh the session, and the callback page must not exchange the code, twice.
import { type ReactNode, useEffect } from 'react';
import { Theme } from '@radix-ui/themes';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { get } from 'idb-keyval';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import type { SelfUser } from 'api/chipin.types';
import { usePersistedUserId } from 'app/providers/persistedUserId';
import { UserQueryProvider } from 'app/providers/UserQueryProvider';
import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { fetchSelfUser } from 'entities/users';
import { establishAuthSession } from 'helpers/authSession';
import {
    getTabUserId,
    hasAuthSessionHint,
    LocalStorage,
    saveLocalUser,
} from 'helpers/localStorage';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
import { useSelfUserState } from 'hooks/useSelfUser';
import { OAuthCallbackPage } from 'pages/oauth-callback-page';
import { clientFor } from 'shared/offline/restore';
import { useAuthStore } from 'store/authStore';
import { resetSessionSelfLoad } from 'store/sessionUser';
import { fakeAccessToken } from 'test/fakeAccessToken';

import { RestoreGate } from './providers/RestoreGate';

import 'fake-indexeddb/auto';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock('api/chipin', () => ({ exchangeApiGoogleOAuthCode: vi.fn() }));
vi.mock('helpers/authSession', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/authSession')>()),
    establishAuthSession: vi.fn(),
}));
// The session loader runs for real; only its `GET /users/self` is a mock.
vi.mock('entities/users', async importOriginal => ({
    ...(await importOriginal<typeof import('entities/users')>()),
    fetchSelfUser: vi.fn(),
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

// What main.tsx does: the provider follows this tab's user (`usePersistedUserId`), the router is
// inside it (a MemoryRouter even restarts at its initial entry on the remount).
const App = ({ initialEntry = '/', probe }: { initialEntry?: string; probe?: ReactNode }) => {
    const userId = usePersistedUserId();

    return (
        <Theme>
            <UserQueryProvider userId={userId}>
                <MemoryRouter initialEntries={[initialEntry]}>
                    <RestoreGate>
                        <MountCounter />
                        <ClientProbe />
                        <SignInCheck />
                        {probe}
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

/** `GET /users/self` answers the user `id`; returns the mock that counts the requests. */
const mockSignedInFetches = (id: string) => {
    return vi.mocked(fetchSelfUser).mockResolvedValue({ ...user, id });
};

beforeEach(() => {
    mounts = 0;
    clients.length = 0;
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
    // A user cached before 03-7a: settings, no id.
    LocalStorage.remove(LS_KEY_USER);
    saveLocalUser({ role: 'USER', settings: user.settings });
    vi.mocked(fetchSelfUser).mockReset();
    resetSessionSelfLoad();
    useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
});

test('the first id after boot: one session refresh, then the user client with its restore', async () => {
    const refresh = vi
        .spyOn(useAuthStore.getState(), 'refreshAuthTokens')
        .mockImplementation(() => {
            useAuthStore.setState({ status: 'authenticated' });
            return Promise.resolve('access-token');
        });
    const loadSelf = mockSignedInFetches('stored-user');

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
    expect(loadSelf).toHaveBeenCalledOnce();
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
    vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
        token: 'access-token',
        is_new_user: false,
    });
    const refresh = vi.spyOn(useAuthStore.getState(), 'refreshAuthTokens');
    const loadSelf = mockSignedInFetches('oauth-user');

    render(<App initialEntry="/oauth/callback?code=single-use-code" />);

    expect(await screen.findByText(DESTINATION_TEXT)).not.toBeNull();
    await waitFor(() => {
        expect(get).toHaveBeenCalledWith('chipin:rq:oauth-user');
    });
    // Hint false → true and the first id: one remount onto the user's client.
    expect(mounts).toBe(2);
    expect(currentClient()).toBe(clientFor('oauth-user'));
    expect(exchangeApiGoogleOAuthCode).toHaveBeenCalledOnce();
    expect(loadSelf).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('authenticated');
});

test('a cached id without a session hint: no IndexedDB read, no persisted client mounted', async () => {
    LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
    saveLocalUser({ id: 'hintless-user', role: 'USER', settings: user.settings });
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
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'expired' });
    vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
        token: fakeAccessToken('cached-user'),
        is_new_user: false,
    });
    // The self load fails: the loader writes nothing.
    vi.mocked(fetchSelfUser).mockRejectedValue(new Error('Network Error'));

    render(<App initialEntry="/oauth/callback?code=cached-user-code" />);

    expect(await screen.findByText(DESTINATION_TEXT)).not.toBeNull();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(currentClient()).toBe(clientFor('cached-user'));
    expect(get).toHaveBeenCalledWith('chipin:rq:cached-user');
    expect(exchangeApiGoogleOAuthCode).toHaveBeenCalledOnce();
});

test("expiry: X's client → anonymous; the hint back with the same id → X's memoized client", async () => {
    saveLocalUser({ id: 'expiring-user', role: 'USER', settings: user.settings });
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
    expect(getTabUserId()).toBe('expiring-user');
    expect(currentClient()).not.toBe(userClient);

    act(() => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
    });
    await screen.findByText(DESTINATION_TEXT);

    expect(currentClient()).toBe(userClient);
});

const RETRY_TEXT = 'retry-self';

// Signed in on the anonymous client after a failed first load: the state settles, Retry reloads.
const SelfRetry = () => {
    const { isError, refetch } = useSelfUserState();

    return isError ? (
        <button type="button" onClick={() => void refetch()}>
            {RETRY_TEXT}
        </button>
    ) : null;
};

test('a fresh OAuth sign-in whose self load fails: an error, then Retry loads once and remounts', async () => {
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, false);
    establishWritesHint();
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'missing' });
    LocalStorage.remove(LS_KEY_USER);
    vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
        token: 'access-token',
        is_new_user: false,
    });
    const loadSelf = vi
        .mocked(fetchSelfUser)
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValue({ ...user, id: 'retry-user' });

    render(<App initialEntry="/oauth/callback?code=retry-code" probe={<SelfRetry />} />);

    const retry = await screen.findByRole('button', { name: RETRY_TEXT });
    expect(mounts).toBe(1);
    expect(getTabUserId()).toBeUndefined();

    fireEvent.click(retry);

    await waitFor(() => {
        expect(currentClient()).toBe(clientFor('retry-user'));
    });
    expect(mounts).toBe(2);
    expect(loadSelf).toHaveBeenCalledTimes(2);
    expect(exchangeApiGoogleOAuthCode).toHaveBeenCalledOnce();
});
