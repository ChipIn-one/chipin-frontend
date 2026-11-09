import { act, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { PUBLIC_ROUTE_ENTRIES } from 'constants/publicRouteManifest';
import type { SelfUser } from 'entities/users';
import { saveLocalUser } from 'helpers/localStorage';
import { useAuthToasts } from 'hooks/useAuthToasts';
import { useScrollToTop } from 'hooks/useScrollToTop';
import { useAuthStore } from 'store/authStore';
import { getOrThrow } from 'test/getOrThrow';

import { PublicEffects } from './PublicEffects';

vi.mock('sonner', () => ({
    Toaster: ({ theme }: { theme: string }) => (
        <output aria-label="Public toast theme">{theme}</output>
    ),
    toast: { message: vi.fn() },
}));
// The session self load the public home waits for, set by each test.
const sessionLoad = vi.hoisted(() => {
    let state: { status: string; user: SelfUser | null } = { status: 'idle', user: null };
    const listeners = new Set<() => void>();

    return {
        get: () => state,
        set: (next: typeof state) => {
            state = next;
            listeners.forEach(listener => {
                listener();
            });
        },
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
});
// Solo is not released: the test opens it to an admin, so the role and the preference decide.
vi.mock('entities/users', async importOriginal => ({
    ...(await importOriginal<typeof import('entities/users')>()),
    canRoleAccessSolo: (role: string | undefined) => role === 'ADMIN',
}));
vi.mock('store/sessionUser', async importOriginal => ({
    ...(await importOriginal<typeof import('store/sessionUser')>()),
    getSessionSelfLoad: sessionLoad.get,
    subscribeSessionSelfLoad: sessionLoad.subscribe,
}));
vi.mock('hooks/useAuthToasts', () => ({ useAuthToasts: vi.fn() }));
vi.mock('hooks/useScrollToTop', () => ({ useScrollToTop: vi.fn() }));
vi.mock('hooks/useCheckSignIn', () => ({ useCheckSignIn: vi.fn() }));
vi.mock('hooks/pwaHooks', () => ({
    useCheckPwa: vi.fn(),
}));
vi.mock('hooks/seoMetadata', () => ({ updateSeoMetadata: vi.fn() }));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            resolvedLanguage: 'en',
            changeLanguage: () => Promise.resolve(),
            getFixedT: () => (key: string) => key,
        },
    }),
}));
beforeEach(() => {
    sessionLoad.set({ status: 'idle', user: null });
    window.sessionStorage.clear();
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'missing' });
});
afterEach(() => {
    vi.restoreAllMocks();
});

test('mounts the existing session-feedback and scroll-restoration hooks on public routes', () => {
    render(<PublicEffects route={getOrThrow(PUBLIC_ROUTE_ENTRIES, 0)} isDark={false} />);

    expect(useAuthToasts).toHaveBeenCalledOnce();
    expect(useScrollToTop).toHaveBeenCalledOnce();
});

test('English privacy offers a localized persistent Sonner action only once', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ru-RU']);
    const route = PUBLIC_ROUTE_ENTRIES.find(item => item.path === '/privacy')!;
    const mounted = render(<PublicEffects route={route} isDark={false} />);
    expect(toast.message).toHaveBeenCalledOnce();
    expect(vi.mocked(toast.message).mock.calls[0]?.[1]).toMatchObject({
        duration: Infinity,
        dismissible: true,
        action: { label: 'public.languageSuggestionAction' },
    });
    mounted.unmount();
    render(<PublicEffects route={route} isDark={false} />);
    expect(toast.message).toHaveBeenCalledOnce();
});

test('explicit locale URL never offers a competing browser language', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
    render(
        <PublicEffects
            route={PUBLIC_ROUTE_ENTRIES.find(r => r.path === '/ru/privacy')!}
            isDark={false}
        />,
    );
    expect(toast.message).not.toHaveBeenCalled();
});

test.each([['ja-JP'], ['es-ES'], ['pt-BR'], ['pt-PT']])(
    'unsupported or removed browser language %s receives no suggestion',
    language => {
        vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue([language]);
        render(
            <PublicEffects
                route={PUBLIC_ROUTE_ENTRIES.find(r => r.path === '/privacy')!}
                isDark={false}
            />,
        );
        expect(toast.message).not.toHaveBeenCalled();
    },
);

test('Sonner follows the public cached-theme snapshot including updates', () => {
    const route = PUBLIC_ROUTE_ENTRIES.find(item => item.path === '/ru/privacy')!;
    const mounted = render(<PublicEffects route={route} isDark />);

    expect(screen.getByRole('status', { name: 'Public toast theme' }).textContent).toBe('dark');
    mounted.rerender(<PublicEffects route={route} isDark={false} />);
    expect(screen.getByRole('status', { name: 'Public toast theme' }).textContent).toBe('light');
});

const goHome = () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, replace });
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
    const home = getOrThrow(
        PUBLIC_ROUTE_ENTRIES.filter(item => item.page === 'home' && item.locale === 'en'),
        0,
    );

    render(<PublicEffects route={home} isDark={false} />);
    return replace;
};

test.each(['loaded', 'failed'] as const)(
    'a signed-in visitor on the public home goes to the app once the session load has %s',
    status => {
        sessionLoad.set({ status: 'loading', user: null });
        const replace = goHome();

        // The redirect would abort the session requests still in flight.
        expect(replace).not.toHaveBeenCalled();

        act(() => {
            sessionLoad.set({ status, user: null });
        });

        expect(replace).toHaveBeenCalledExactlyOnceWith('/dashboard');
        vi.unstubAllGlobals();
    },
);

const SETTINGS = {
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
} as const;

const loadedUser = (role: 'USER' | 'ADMIN', soloModeByDefault: boolean): SelfUser => ({
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role,
    subscriptionUntil: null,
    inviteToken: 'invite',
    settings: { ...SETTINGS, soloModeByDefault },
    createdAt: 1,
    updatedAt: 1,
});

test.each([
    { cached: ['USER', false], loaded: ['ADMIN', true], expected: '/solo' },
    { cached: ['ADMIN', true], loaded: ['USER', true], expected: '/dashboard' },
    { cached: ['ADMIN', true], loaded: ['ADMIN', false], expected: '/dashboard' },
] as const)(
    'the loaded user ($loaded) decides over a stale cached one ($cached): $expected',
    ({ cached, loaded, expected }) => {
        saveLocalUser({
            id: 'user-1',
            role: cached[0],
            settings: { ...SETTINGS, soloModeByDefault: cached[1] },
        });
        sessionLoad.set({ status: 'loaded', user: loadedUser(loaded[0], loaded[1]) });

        const replace = goHome();

        expect(replace).toHaveBeenCalledExactlyOnceWith(expected);
        vi.unstubAllGlobals();
    },
);
