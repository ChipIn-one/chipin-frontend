import { toast } from 'sonner';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { act, renderHook, waitFor } from '@testing-library/react';

import type { SharingMode } from 'api/chipin.types';
import { useActivityStore } from 'store/activity-store';
import type { ExpenseModalEditInitialization } from 'store/expenseModalStore';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { useExpenseModalOpenChange, useExpenseModalSubmit } from './hooks';

import 'i18n/index';

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

const currentUser = {
    id: 'user-1',
    displayName: 'You',
    picture: null,
};

const friend = {
    id: 'user-2',
    displayName: 'Friend',
    picture: null,
};

const originalSharingMode: SharingMode = { type: 'AUTO' };

const editInitialization: ExpenseModalEditInitialization = {
    mode: 'edit',
    source: {
        context: 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [friend],
    },
    targetMode: 'friends',
    groupId: '',
    selectedFriendId: friend.id,
    description: 'Dinner',
    amount: '20',
    currency: 'USD',
    category: 'food',
    paidById: currentUser.id,
    splitMode: 'equal',
    percentShares: { [currentUser.id]: '50', [friend.id]: '50' },
    amountShares: { [currentUser.id]: '0', [friend.id]: '0' },
    shareWeights: { [currentUser.id]: '1', [friend.id]: '1' },
    includedParticipantIds: { [currentUser.id]: true, [friend.id]: true },
    isPercentManuallyEdited: false,
    editContext: {
        entryId: 'entry-1',
        parentActivityId: 'activity-1',
        original: {
            description: 'Dinner',
            amount: 20,
            payerId: currentUser.id,
            participantIds: [currentUser.id, friend.id],
            currency: 'USD',
            category: 'food',
            subcategory: 'restaurants',
            sharingMode: originalSharingMode,
        },
    },
};

const originalActivityActions = {
    createExpense: useActivityStore.getState().createExpense,
    updateExpense: useActivityStore.getState().updateExpense,
};

beforeEach(() => {
    useExpenseModalStore.getState().reset();
    vi.clearAllMocks();
});

afterEach(() => {
    useActivityStore.setState(originalActivityActions);
    useExpenseModalStore.getState().reset();
});

test('runs the lifecycle callback when the modal is initially open', () => {
    const onOpenChange = vi.fn();

    renderHook(() => useExpenseModalOpenChange(true, onOpenChange));

    expect(onOpenChange).toHaveBeenCalledTimes(1);
});

test('runs the lifecycle callback when the modal opens', () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderHook(
        ({ isOpened }) => useExpenseModalOpenChange(isOpened, onOpenChange),
        { initialProps: { isOpened: false } },
    );

    expect(onOpenChange).not.toHaveBeenCalled();

    rerender({ isOpened: true });

    expect(onOpenChange).toHaveBeenCalledTimes(1);
});

test('does not rerun when only the callback identity changes', () => {
    const firstOnOpenChange = vi.fn();
    const secondOnOpenChange = vi.fn();
    const { rerender } = renderHook(
        ({ onOpenChange }) =>
            useExpenseModalOpenChange(true, onOpenChange),
        { initialProps: { onOpenChange: firstOnOpenChange } },
    );

    rerender({ onOpenChange: secondOnOpenChange });

    expect(firstOnOpenChange).toHaveBeenCalledTimes(1);
    expect(secondOnOpenChange).not.toHaveBeenCalled();
});

test('submits an edit patch and closes after a successful update', () => {
    const createExpense = vi.fn().mockResolvedValue(undefined);
    const updateExpense = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    useActivityStore.setState({ createExpense, updateExpense });
    useExpenseModalStore.getState().initializeEdit(editInitialization);
    useExpenseModalStore.getState().setDescription('Lunch');

    const { result } = renderHook(() => useExpenseModalSubmit(onClose));

    act(() => {
        result.current.onSubmit();
    });

    return waitFor(() => {
        expect(updateExpense).toHaveBeenCalledWith({
            entryId: 'entry-1',
            entry: {
                type: 'EXPENSE',
                expense: { description: 'Lunch' },
            },
            groupId: undefined,
            parentActivityId: 'activity-1',
        });
        expect(createExpense).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledOnce();
        expect(toast.success).toHaveBeenCalledWith('Expense updated successfully!');
    });
});

test('keeps the edit open when the update fails', () => {
    const updateError = new Error('Update failed');
    const updateExpense = vi.fn().mockRejectedValue(updateError);
    const onClose = vi.fn();

    useActivityStore.setState({ updateExpense });
    useExpenseModalStore.getState().initializeEdit(editInitialization);
    useExpenseModalStore.getState().setDescription('Lunch');

    const { result } = renderHook(() => useExpenseModalSubmit(onClose));

    act(() => {
        result.current.onSubmit();
    });

    return waitFor(() => {
        expect(onClose).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalled();
        expect(useExpenseModalStore.getState().description).toBe('Lunch');
    });
});
