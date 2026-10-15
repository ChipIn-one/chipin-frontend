import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { toast } from 'sonner';

import { render, screen } from '@testing-library/react';

import { PUBLIC_ROUTE_ENTRIES } from 'constants/publicRouteManifest';
import { useAuthToasts } from 'hooks/useAuthToasts';
import { useScrollToTop } from 'hooks/useScrollToTop';

import { PublicEffects } from './PublicEffects';

vi.mock('sonner', () => ({
    Toaster: ({ theme }: { theme: string }) => <output aria-label="Public toast theme">{theme}</output>,
    toast: { message: vi.fn() },
}));
vi.mock('hooks/useAuthToasts', () => ({ useAuthToasts: vi.fn() }));
vi.mock('hooks/useScrollToTop', () => ({ useScrollToTop: vi.fn() }));
vi.mock('hooks/useCheckSignIn', () => ({ useCheckSignIn: vi.fn() }));
vi.mock('hooks/pwaHooks', () => ({
    useCheckPwa: vi.fn(),
    useCheckOnlineStatus: vi.fn(),
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
vi.mock('./internal/useConnect', () => ({
    useConnect: () => ({
        isAuthResolved: true,
        isLoggedIn: false,
        isUserFetched: false,
        settings: null,
        canAccessSolo: false,
    }),
}));

beforeEach(() => { window.sessionStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

test('mounts the existing session-feedback and scroll-restoration hooks on public routes', () => {
    render(<PublicEffects route={PUBLIC_ROUTE_ENTRIES[0]} isDark={false} />);

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
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ru-RU']);
    render(<PublicEffects route={PUBLIC_ROUTE_ENTRIES.find(r => r.path === '/es/privacy')!} isDark={false} />);
    expect(toast.message).not.toHaveBeenCalled();
});

test('unsupported browser languages receive no suggestion', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ja-JP']);
    render(<PublicEffects route={PUBLIC_ROUTE_ENTRIES.find(r => r.path === '/privacy')!} isDark={false} />);
    expect(toast.message).not.toHaveBeenCalled();
});

test('Sonner follows the public cached-theme snapshot including updates', () => {
    const route = PUBLIC_ROUTE_ENTRIES.find(item => item.path === '/ru/privacy')!;
    const mounted = render(<PublicEffects route={route} isDark />);

    expect(screen.getByRole('status', { name: 'Public toast theme' }).textContent).toBe('dark');
    mounted.rerender(<PublicEffects route={route} isDark={false} />);
    expect(screen.getByRole('status', { name: 'Public toast theme' }).textContent).toBe('light');
});
