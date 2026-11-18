import { act, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { PUBLIC_ROUTE_ENTRIES } from 'constants/publicRouteManifest';
import type { SelfUser } from 'entities/users';
import { saveLocalUser, setAuthSessionHint } from 'helpers/localStorage';
import { useAuthToasts } from 'hooks/useAuthToasts';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
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
// The `lng|ns` bundles i18next holds; a read through `reloadResources` adds them (a test may make
// it wait or fail).
const bundles = vi.hoisted(() => new Set<string>());
const readBundles = (lngs: readonly string[], namespaces: readonly string[]) => {
    lngs.forEach(lng => {
        namespaces.forEach(ns => bundles.add(`${lng}|${ns}`));
    });
    return Promise.resolve();
};
const reloadResources = vi.hoisted(() =>
    vi.fn((_lngs: readonly string[], _namespaces: readonly string[]) => Promise.resolve()),
);
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            resolvedLanguage: 'en',
            reloadResources,
            hasResourceBundle: (lng: string, ns: string) => bundles.has(`${lng}|${ns}`),
            getFixedT: () => (key: string) => key,
        },
    }),
}));
beforeEach(() => {
    bundles.clear();
    reloadResources.mockImplementation(readBundles);
    sessionLoad.set({ status: 'idle', user: null });
    window.sessionStorage.clear();
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'missing' });
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setAuthSessionHint(false);
});

test('mounts the existing session-feedback and scroll-restoration hooks on public routes', () => {
    render(<PublicEffects route={getOrThrow(PUBLIC_ROUTE_ENTRIES, 0)} isDark={false} />);

    expect(useAuthToasts).toHaveBeenCalledOnce();
    expect(useScrollToTop).toHaveBeenCalledOnce();
    expect(useCheckSignIn).toHaveBeenCalledOnce();
});

// 04-4a2 (spec 04 §4.5 step 1): on a legacy host the landing makes no auth call; a visitor with a
// session hint goes straight to the app host of the same environment.
const renderPageOn = (hostname: string, path: string) => {
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, hostname, replace });

    render(
        <PublicEffects
            route={getOrThrow(
                PUBLIC_ROUTE_ENTRIES.filter(item => item.path === path),
                0,
            )}
            isDark={false}
        />,
    );
    return replace;
};
const renderHomeOn = (hostname: string) => renderPageOn(hostname, '/');

test.each([
    ['chipin.one', 'https://app.chipin.one/dashboard'],
    ['dev.chipin.one', 'https://app-dev.chipin.one/dashboard'],
])('on %s a visitor with a session hint goes to %s without a session check', (host, target) => {
    useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
    const refreshAuthTokens = vi.fn(() => Promise.resolve('token'));
    useAuthStore.setState({ refreshAuthTokens });
    setAuthSessionHint(true);

    const replace = renderHomeOn(host);

    expect(replace).toHaveBeenCalledExactlyOnceWith(target);
    expect(useCheckSignIn).not.toHaveBeenCalled();
    expect(refreshAuthTokens).not.toHaveBeenCalled();
});

test.each(['chipin.one', 'dev.chipin.one'])(
    'on %s the Russian home also hands a visitor with a hint to the app host',
    host => {
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
        setAuthSessionHint(true);

        const replace = renderPageOn(host, '/ru/');

        expect(replace).toHaveBeenCalledOnce();
        expect(useCheckSignIn).not.toHaveBeenCalled();
    },
);

// M2 of the 04-4a2 review: the legal pages stay readable for a former user with a hint (store
// listing, OAuth consent and mail link there); the visitor is anonymous locally, with no request.
test.each(
    ['chipin.one', 'dev.chipin.one'].flatMap(host =>
        ['/privacy', '/terms', '/ru/privacy', '/ru/terms'].map(path => [host, path]),
    ),
)('on %s%s a visitor with a hint stays, anonymous, with no check', (host, path) => {
    useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
    const refreshAuthTokens = vi.fn(() => Promise.resolve('token'));
    useAuthStore.setState({ refreshAuthTokens });
    setAuthSessionHint(true);

    const replace = renderPageOn(host, path);

    expect(replace).not.toHaveBeenCalled();
    expect(useCheckSignIn).not.toHaveBeenCalled();
    expect(refreshAuthTokens).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({
        status: 'unauthenticated',
        unauthReason: 'missing',
    });
});

test('on a legacy host a visitor without a hint stays on the landing, anonymous, with no check', () => {
    useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
    const refreshAuthTokens = vi.fn(() => Promise.resolve('token'));
    useAuthStore.setState({ refreshAuthTokens });
    setAuthSessionHint(false);

    const replace = renderHomeOn('chipin.one');

    expect(replace).not.toHaveBeenCalled();
    expect(useCheckSignIn).not.toHaveBeenCalled();
    expect(refreshAuthTokens).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({
        status: 'unauthenticated',
        unauthReason: 'missing',
    });
});

// #758: in an icon installed from a legacy host the app host would open in an in-app sheet whose
// session never reaches the icon, so the home page stays (with the notice), anonymous, no check.
const stubStandaloneDisplayMode = () => {
    vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
            matches: query === '(display-mode: standalone)',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })),
    );
};

test.each(['chipin.one', 'dev.chipin.one'])(
    'on %s in standalone mode a visitor with a hint stays on the home page, with no check',
    host => {
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
        const refreshAuthTokens = vi.fn(() => Promise.resolve('token'));
        useAuthStore.setState({ refreshAuthTokens });
        setAuthSessionHint(true);
        stubStandaloneDisplayMode();

        const replace = renderHomeOn(host);

        expect(replace).not.toHaveBeenCalled();
        expect(useCheckSignIn).not.toHaveBeenCalled();
        expect(refreshAuthTokens).not.toHaveBeenCalled();
        expect(useAuthStore.getState()).toMatchObject({
            status: 'unauthenticated',
            unauthReason: 'missing',
        });
    },
);

test.each(['app.chipin.one', 'app-dev.chipin.one', 'chipin-git-x.vercel.app'])(
    'on %s in standalone mode the session check runs as before',
    host => {
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
        setAuthSessionHint(true);
        stubStandaloneDisplayMode();

        const replace = renderHomeOn(host);

        expect(useCheckSignIn).toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
    },
);

test.each(['app.chipin.one', 'app-dev.chipin.one', 'chipin-git-x.vercel.app'])(
    'on %s the session check runs as before',
    host => {
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
        setAuthSessionHint(true);

        const replace = renderHomeOn(host);

        expect(useCheckSignIn).toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
    },
);

test('English privacy offers a localized persistent Sonner action only once', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ru-RU']);
    const route = PUBLIC_ROUTE_ENTRIES.find(item => item.path === '/privacy')!;
    const mounted = render(<PublicEffects route={route} isDark={false} />);
    // The suggested language is a lazy chunk: it is loaded before the toast is translated.
    await vi.waitFor(() => {
        expect(toast.message).toHaveBeenCalledOnce();
    });
    // Only the `toasts` namespace of the suggested language is read.
    expect(reloadResources).toHaveBeenCalledExactlyOnceWith(['ru'], ['toasts']);
    expect(vi.mocked(toast.message).mock.calls[0]?.[1]).toMatchObject({
        duration: Infinity,
        dismissible: true,
        action: { label: 'public.languageSuggestionAction' },
    });
    mounted.unmount();
    render(<PublicEffects route={route} isDark={false} />);
    await Promise.resolve();
    expect(toast.message).toHaveBeenCalledOnce();
    expect(reloadResources).toHaveBeenCalledOnce();
});

// R1 L3: the persistent toast never appears on a page the visitor already left.
test('no suggestion toast when the page unmounts before the strings load', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ru-RU']);
    let finishRead: () => void = () => undefined;
    reloadResources.mockImplementation(
        (lngs, namespaces) =>
            new Promise(resolve => {
                finishRead = () => {
                    void readBundles(lngs, namespaces).then(resolve);
                };
            }),
    );
    const route = getOrThrow(
        PUBLIC_ROUTE_ENTRIES.filter(item => item.path === '/privacy'),
        0,
    );
    const mounted = render(<PublicEffects route={route} isDark={false} />);

    mounted.unmount();
    finishRead();
    await new Promise(resolve => {
        setTimeout(resolve, 0);
    });
    expect(toast.message).not.toHaveBeenCalled();
});

test('no suggestion toast in English when the suggested strings fail to load', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ru-RU']);
    // i18next resolves a failed read; the bundle is just not there.
    reloadResources.mockImplementation(() => Promise.resolve());
    const route = getOrThrow(
        PUBLIC_ROUTE_ENTRIES.filter(item => item.path === '/privacy'),
        0,
    );

    render(<PublicEffects route={route} isDark={false} />);
    await new Promise(resolve => {
        setTimeout(resolve, 0);
    });
    expect(reloadResources).toHaveBeenCalledOnce();
    expect(toast.message).not.toHaveBeenCalled();
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
    },
);
