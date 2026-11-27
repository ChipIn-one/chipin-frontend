import { render } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useGroupDetail } from 'hooks/useGroupDetail';
import { i18n } from 'i18n';

import { markRouteErrorShown } from './routeErrorTitle';
import { useDocumentTitle } from './useDocumentTitle';

vi.mock('hooks/useGroupDetail', () => ({
    useGroupDetail: vi.fn(() => ({ group: undefined })),
}));

const UUID = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';

const Shell = () => {
    useDocumentTitle();
    return <Outlet />;
};

const renderAt = (path: string) => {
    const router = createMemoryRouter(
        [
            {
                element: <Shell />,
                children: [
                    { path: '/dashboard', handle: { meta: { titleKey: 'dashboard.title' } } },
                    {
                        path: '/group/:groupId',
                        handle: {
                            meta: {
                                titleKey: 'group.title',
                                entityTitleKey: 'group.titleWithName',
                            },
                        },
                    },
                    { path: '/without-meta' },
                ],
            },
        ],
        { initialEntries: [path] },
    );

    render(<RouterProvider router={router} />);
    return router;
};

beforeEach(async () => {
    document.title = 'initial';
    vi.mocked(useGroupDetail).mockReturnValue({ group: undefined } as ReturnType<
        typeof useGroupDetail
    >);
    await i18n.changeLanguage('en');
});

afterEach(() => {
    document.title = '';
});

test('04-2a3: the title of an app route comes from its handle.meta', () => {
    renderAt('/dashboard');

    expect(document.title).toBe(i18n.t('dashboard.title', { ns: 'meta' }));
});

test('04-2a3: a route without handle.meta keeps the current title', () => {
    renderAt('/without-meta');

    expect(document.title).toBe('initial');
});

test('04-2a3: a valid group id asks for the group; an invalid one asks for none', () => {
    renderAt(`/group/${UUID}`);
    expect(useGroupDetail).toHaveBeenLastCalledWith(UUID);

    renderAt('/group/123');
    expect(useGroupDetail).toHaveBeenLastCalledWith(undefined);
});

test('04-2a3: while a route error view is shown the title is not overwritten, and returns after', async () => {
    const unmark = markRouteErrorShown();
    renderAt('/dashboard');
    expect(document.title).toBe('initial');

    unmark();
    await vi.waitFor(() => {
        expect(document.title).toBe(i18n.t('dashboard.title', { ns: 'meta' }));
    });
});
