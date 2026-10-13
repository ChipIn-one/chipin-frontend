import { expect, test, vi } from 'vitest';

import { render } from '@testing-library/react';

import { PUBLIC_ROUTE_ENTRIES } from 'constants/publicRouteManifest';
import { useAuthToasts } from 'hooks/useAuthToasts';
import { useScrollToTop } from 'hooks/useScrollToTop';

import { PublicEffects } from './PublicEffects';

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
        },
    }),
}));
vi.mock('./internal/useConnect', () => ({
    useConnect: () => ({
        isAuthResolved: false,
        isLoggedIn: false,
        isUserFetched: false,
        settings: null,
        canAccessSolo: false,
    }),
}));

test('mounts the existing session-feedback and scroll-restoration hooks on public routes', () => {
    render(<PublicEffects route={PUBLIC_ROUTE_ENTRIES[0]} />);

    expect(useAuthToasts).toHaveBeenCalledOnce();
    expect(useScrollToTop).toHaveBeenCalledOnce();
});
