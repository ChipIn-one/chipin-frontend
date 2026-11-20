// Spec 04 §2.3 (04-2a2b): `SoloGuardLayout` replaces `SoloRouteGuard`; the assertions of
// `features/routing/SoloRouteGuard.test.tsx` moved here, plus its loader.
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { type SelfUser, usersKeys } from 'entities/users';
import { startCacheRestore } from 'shared/offline/restore';
import { useAuthStore } from 'store/authStore';
import { createTestQueryClient } from 'test/renderWithQueryClient';
import { signInWithSelf } from 'test/selfUser';

import { SoloGuardLayout, soloGuardLoader } from './SoloGuardLayout';

const settings = {
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
} satisfies UserSettings;

const selfUser = (role: 'USER' | 'ADMIN'): SelfUser => ({
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Alex',
    picture: null,
    role,
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings,
    createdAt: 1,
    updatedAt: 1,
});

const LocationPath = () => {
    const location = useLocation();

    return (
        <div role="note" aria-label="Current route">
            {location.pathname}
        </div>
    );
};

let routers: ReturnType<typeof createMemoryRouter>[] = [];

const renderGuard = (role: 'USER' | 'ADMIN' | null) => {
    if (role) {
        signInWithSelf(selfUser(role));
    }
    const router = createMemoryRouter(
        [
            {
                path: '/solo',
                element: <SoloGuardLayout />,
                children: [{ index: true, element: <LocationPath /> }],
            },
            { path: '/dashboard', element: <LocationPath /> },
        ],
        { initialEntries: ['/solo'] },
    );

    routers.push(router);
    render(<RouterProvider router={router} />);
};

beforeAll(() => {
    startCacheRestore(undefined);
});

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
});

afterEach(() => {
    routers.forEach(router => router.dispose());
    routers = [];
});

describe('SoloGuardLayout', () => {
    test.each(['USER', 'ADMIN'] as const)(
        'redirects a %s from the Solo route to the dashboard',
        role => {
            renderGuard(role);

            expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
        },
    );

    test('waits while the self user is still to come', () => {
        renderGuard(null);

        expect(screen.queryByLabelText('Current route')).toBeNull();
    });
});

const SOLO_REQUEST = { request: new Request('http://localhost/solo') };

describe('soloGuardLoader', () => {
    test('a signed-in cached profile without Solo access: to the dashboard', async () => {
        const client = createTestQueryClient();
        client.setQueryData(usersKeys.self(), selfUser('ADMIN'));

        const response = await soloGuardLoader(client)(SOLO_REQUEST);

        expect(response?.headers.get('Location')).toBe('/dashboard');
    });

    test('no cached profile: through, the layout decides when it arrives', async () => {
        await expect(soloGuardLoader(createTestQueryClient())(SOLO_REQUEST)).resolves.toBeNull();
    });

    test('signed out: through, the auth layout shows the sign-in on the same URL', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'expired' });
        const client = createTestQueryClient();
        client.setQueryData(usersKeys.self(), selfUser('ADMIN'));

        await expect(soloGuardLoader(client)(SOLO_REQUEST)).resolves.toBeNull();
    });
});
