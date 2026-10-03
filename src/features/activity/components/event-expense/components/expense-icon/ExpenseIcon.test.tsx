import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { ACTIVITY_ACTIONS } from 'constants/activity';

import { ExpenseIcon } from './ExpenseIcon';

vi.mock('@radix-ui/themes', () => ({
    Avatar: ({
        color,
        fallback,
    }: {
        color?: string;
        fallback: ReactNode;
    }) => (
        <div data-testid="expense-icon" data-color={color}>
            {fallback}
        </div>
    ),
}));

vi.mock('constants/category', () => ({
    EXPENSE_CATEGORY_KEYS: ['food'],
}));

vi.mock('constants/category-ui', () => ({
    EXPENSE_CATEGORY_UI: {
        food: {
            icon: () => <span data-testid="category-icon" />,
            color: 'orange',
            subcategories: {
                groceries: {
                    icon: () => <span data-testid="subcategory-icon" />,
                    color: 'green',
                },
            },
        },
    },
}));

vi.mock('lucide-react', () => ({
    LucideBanknoteArrowDown: () => <span data-testid="generic-down-icon" />,
    LucideBanknoteArrowUp: () => <span data-testid="generic-up-icon" />,
    LucideTrash2: () => <span data-testid="reversed-icon" />,
}));

type ExpenseAction =
    | typeof ACTIVITY_ACTIONS.EXPENSE_CREATED
    | typeof ACTIVITY_ACTIONS.EXPENSE_UPDATED
    | typeof ACTIVITY_ACTIONS.EXPENSE_REVERSED;

const renderExpenseIcon = ({
    action = ACTIVITY_ACTIONS.EXPENSE_CREATED,
    category,
    subcategory,
    hasCurrentUser = true,
    isCurrentUserPayer = false,
}: {
    action?: ExpenseAction;
    category?: string | null;
    subcategory?: string | null;
    hasCurrentUser?: boolean;
    isCurrentUserPayer?: boolean;
} = {}): void => {
    render(
        <ExpenseIcon
            action={action}
            category={category}
            subcategory={subcategory}
            hasCurrentUser={hasCurrentUser}
            isCurrentUserPayer={isCurrentUserPayer}
        />,
    );
};

test('uses the configured subcategory icon and color', () => {
    renderExpenseIcon({
        category: 'food',
        subcategory: 'groceries',
    });

    expect(screen.getByTestId('subcategory-icon')).toBeTruthy();
    expect(screen.getByTestId('expense-icon').dataset.color).toBe('green');
});

test('falls back to the configured category when the subcategory is not configured', () => {
    renderExpenseIcon({
        category: 'food',
        subcategory: 'unknown-subcategory',
    });

    expect(screen.getByTestId('category-icon')).toBeTruthy();
    expect(screen.getByTestId('expense-icon').dataset.color).toBe('orange');
});

test('keeps the generic expense fallback when category metadata is absent', () => {
    renderExpenseIcon();

    expect(screen.getByTestId('generic-down-icon')).toBeTruthy();
    expect(screen.getByTestId('expense-icon').dataset.color).toBe('red');
});

test('falls back safely for unknown category and subcategory values', () => {
    renderExpenseIcon({
        category: 'unknown-category',
        subcategory: 'unknown-subcategory',
        isCurrentUserPayer: true,
    });

    expect(screen.getByTestId('generic-up-icon')).toBeTruthy();
    expect(screen.getByTestId('expense-icon').dataset.color).toBe('green');
});

test('uses category metadata for updated expenses', () => {
    renderExpenseIcon({
        action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
        category: 'food',
        subcategory: 'groceries',
    });

    expect(screen.getByTestId('subcategory-icon')).toBeTruthy();
    expect(screen.getByTestId('expense-icon').dataset.color).toBe('green');
});

test('keeps the red reversed expense icon even when category metadata is present', () => {
    renderExpenseIcon({
        action: ACTIVITY_ACTIONS.EXPENSE_REVERSED,
        category: 'food',
        subcategory: 'groceries',
    });

    expect(screen.getByTestId('reversed-icon')).toBeTruthy();
    expect(screen.queryByTestId('subcategory-icon')).toBeNull();
    expect(screen.queryByTestId('category-icon')).toBeNull();
    expect(screen.getByTestId('expense-icon').dataset.color).toBe('red');
});
