import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { useExpenseModalStore } from 'store/expenseModalStore';

import { useEmptyStateAddExpenseAction } from './EmptyStateAddExpenseButton';

const availabilityMock = vi.hoisted(() =>
    vi.fn<(pathname: string) => { isSoloMode: boolean; isVisible: boolean }>(),
);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('hooks/useAddExpenseAvailability', () => ({
    useAddExpenseAvailability: availabilityMock,
}));

const renderAction = (pathname = '/dashboard') =>
    renderHook(() => useEmptyStateAddExpenseAction(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
        ),
    });

beforeEach(() => {
    vi.clearAllMocks();
    availabilityMock.mockReturnValue({ isSoloMode: false, isVisible: true });
    useExpenseModalStore.getState().reset();
});

test('EXP-065: the action opens the shell new-expense editor with no opening options', () => {
    const { result } = renderAction();

    render(<>{result.current}</>);
    fireEvent.click(screen.getByRole('button', { name: 'buttons.addExpense' }));

    const state = useExpenseModalStore.getState();

    expect(state.isOpened).toBe(true);
    expect(state.mode).toBe('create');
    expect(state.openingContext).toBeUndefined();
    expect(state.openingFriendId).toBeUndefined();
});

test('EXP-065: the action follows the shell availability of the current route', () => {
    renderAction('/group/group-1');

    expect(availabilityMock).toHaveBeenCalledWith('/group/group-1');
});

test('EXP-065: the action is absent when the shell Add Expense action is absent', () => {
    availabilityMock.mockReturnValue({ isSoloMode: false, isVisible: false });

    const { result } = renderAction();

    expect(result.current).toBeUndefined();
});
