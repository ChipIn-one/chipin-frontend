import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import { GlobalHooks } from './GlobalHooks';

vi.mock('hooks/pwaHooks', () => ({
    useCheckPwa: vi.fn(),
}));

vi.mock('hooks/useAuthToasts', () => ({
    useAuthToasts: vi.fn(),
}));

vi.mock('hooks/useCheckSignIn', () => ({
    useCheckSignIn: vi.fn(),
}));

vi.mock('hooks/useRoutesMeta', () => ({
    useRoutesMeta: vi.fn(),
}));

vi.mock('hooks/useSyncAppMode', () => ({
    useSyncAppMode: vi.fn(),
}));

vi.mock('hooks/useSyncUserSettings', () => ({
    useSyncUserSettings: vi.fn(),
}));

test('GlobalHooks scrolls nothing itself: ScrollRestoration in RootLayout owns it (04-2a3)', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);

    try {
        render(
            <MemoryRouter initialEntries={['/activity']}>
                <GlobalHooks />
            </MemoryRouter>,
        );

        expect(scrollTo).not.toHaveBeenCalled();
    } finally {
        vi.unstubAllGlobals();
    }
});
