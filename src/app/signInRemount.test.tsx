// Spec 03 §1.5: the first `LocalUser.id` after boot (a fresh sign-in, or the first `fetchSetUser`
// for a stored user written before 03-7a) remounts the app on that user's client. The remounted
// sign-in check must not refresh the session, and the callback page must not exchange the code, twice.
import { useEffect } from 'react';
import { Theme } from '@radix-ui/themes';
import { render, screen, waitFor } from '@testing-library/react';
import { get } from 'idb-keyval';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import type { SelfUser } from 'api/chipin.types';
import { UserQueryProvider } from 'app/providers/UserQueryProvider';
import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { LocalStorage, saveLocalUser } from 'helpers/localStorage';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
import { OAuthCallbackPage } from 'pages/oauth-callback-page';
import { useAuthStore } from 'store/authStore';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/users-store';

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

const DESTINATION_TEXT = 'destination';
const Destination = () => <p>{DESTINATION_TEXT}</p>;

// What main.tsx does: the provider follows `localUser.id` from the users store, the router is
// inside it (a MemoryRouter even restarts at its initial entry on the remount).
const App = ({ initialEntry = '/' }: { initialEntry?: string }) => {
    const userId = useUsersStore(state => state.localUser?.id);

    return (
        <Theme>
            <UserQueryProvider userId={userId}>
                <MemoryRouter initialEntries={[initialEntry]}>
                    <RestoreGate>
                        <MountCounter />
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

test('a fresh OAuth sign-in: the remounted callback page does not exchange the code twice', async () => {
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
    expect(mounts).toBe(2);
    expect(exchangeApiGoogleOAuthCode).toHaveBeenCalledOnce();
    expect(fetchSetUser).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('authenticated');
});
