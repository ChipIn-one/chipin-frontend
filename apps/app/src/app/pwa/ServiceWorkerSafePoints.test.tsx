// Spec 04 §2.11 item 3 (04-2d, C3-12): the safe point of a forced update.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { outboxSendingOpId } from 'shared/offline/outboxStore';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { isAtSafePoint, onRouteChange, setSafePointCheck } from './safePoint';
import {
    hasDirtyExpenseDraft,
    isAppSafeToReload,
    ServiceWorkerSafePoints,
} from './ServiceWorkerSafePoints';

vi.mock('shared/offline/outboxStore', async importOriginal => ({
    ...(await importOriginal<typeof import('shared/offline/outboxStore')>()),
    outboxSendingOpId: vi.fn(() => null),
}));

const closedDraft = { isOpened: false, mode: 'create', description: '', amount: '' } as const;

beforeEach(() => {
    useExpenseModalStore.getState().reset();
    setSafePointCheck(null);
});

afterEach(() => {
    useExpenseModalStore.getState().reset();
    setSafePointCheck(null);
});

describe('hasDirtyExpenseDraft', () => {
    test.each([
        ['a closed modal', closedDraft, false],
        ['an open, untouched create form', { ...closedDraft, isOpened: true }, false],
        [
            'a create form with a description',
            { ...closedDraft, isOpened: true, description: 'x' },
            true,
        ],
        ['a create form with an amount', { ...closedDraft, isOpened: true, amount: '1' }, true],
        ['an open edit form', { ...closedDraft, isOpened: true, mode: 'edit' }, true],
    ] as const)('%s → %s', (_name, state, expected) => {
        expect(hasDirtyExpenseDraft(state)).toBe(expected);
    });
});

describe('isAppSafeToReload', () => {
    test('holds with no mutation, no outbox send and no dirty draft', () => {
        expect(isAppSafeToReload(new QueryClient())).toBe(true);
    });

    test('a running mutation blocks it', () => {
        const queryClient = new QueryClient();
        vi.spyOn(queryClient, 'isMutating').mockReturnValue(1);

        expect(isAppSafeToReload(queryClient)).toBe(false);
    });

    test('an outbox operation in sending blocks it', () => {
        vi.mocked(outboxSendingOpId).mockReturnValueOnce('op-1');

        expect(isAppSafeToReload(new QueryClient())).toBe(false);
    });

    test('an open modal with a dirty draft blocks it', () => {
        useExpenseModalStore.setState({ isOpened: true, description: 'Lunch' });

        expect(isAppSafeToReload(new QueryClient())).toBe(false);
    });
});

test('the app shell reports its check and its route changes, not the first route', async () => {
    const queryClient = new QueryClient();
    const routeChanges = vi.fn();
    const stop = onRouteChange(routeChanges);
    const router = createMemoryRouter([{ path: '*', element: <ServiceWorkerSafePoints /> }], {
        initialEntries: ['/dashboard'],
    });
    const view = render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );

    expect(routeChanges).not.toHaveBeenCalled();
    useExpenseModalStore.setState({ isOpened: true, amount: '5' });
    expect(isAtSafePoint()).toBe(false);

    await act(() => router.navigate('/friends'));
    expect(routeChanges).toHaveBeenCalledOnce();

    view.unmount();
    // Without the app shell (the landing) every point is safe.
    expect(isAtSafePoint()).toBe(true);
    stop();
});
