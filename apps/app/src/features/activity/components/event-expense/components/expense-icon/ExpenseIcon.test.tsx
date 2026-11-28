import { PROP_COLOR } from '@chipin/tokens/theme';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

import { ACTIVITY_ACTIONS } from 'constants/activity';

import { ExpenseIcon } from './ExpenseIcon';

vi.mock('@radix-ui/themes', () => ({
    Avatar: ({
        color,
        fallback,
        role,
        'aria-label': ariaLabel,
    }: {
        color?: string;
        fallback: ReactNode;
        role?: string;
        'aria-label'?: string;
    }) => (
        <div data-testid="expense-icon" data-color={color} role={role} aria-label={ariaLabel}>
            {fallback}
        </div>
    ),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            if (key === 'expenses.modal.categories.food') {
                return 'Food';
            }

            if (key === 'expenses.modal.subcategories.groceries') {
                return 'Groceries';
            }

            return key;
        },
    }),
}));

vi.mock('constants/category', () => ({
    EXPENSE_CATEGORY_KEYS: ['food'],
}));

// Mock colors are roles: palette names live only in constants/category-ui.ts.
vi.mock('constants/category-ui', async () => {
    const { PROP_COLOR } = await import('@chipin/tokens/theme');

    return {
        EXPENSE_CATEGORY_UI: {
            food: {
                icon: ({ size }: { size?: number }) => (
                    <span data-testid="category-icon" data-size={size} />
                ),
                color: PROP_COLOR.warning,
                subcategories: {
                    groceries: {
                        icon: ({ size }: { size?: number }) => (
                            <span data-testid="subcategory-icon" data-size={size} />
                        ),
                        color: PROP_COLOR.success,
                    },
                },
            },
        },
    };
});

vi.mock('lucide-react', () => ({
    BanknoteArrowDownIcon: () => <span data-testid="generic-down-icon" />,
    BanknoteArrowUpIcon: () => <span data-testid="generic-up-icon" />,
    Trash2Icon: () => <span data-testid="reversed-icon" />,
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

test('uses the configured subcategory icon, color, and accessible name', () => {
    renderExpenseIcon({
        category: 'food',
        subcategory: 'groceries',
    });

    expect(screen.getByTestId('subcategory-icon').dataset.size).toBe('24');
    expect(screen.getByTestId('expense-icon').dataset.color).toBe(PROP_COLOR.success);
    expect(screen.getByRole('img', { name: 'Groceries' })).toBeTruthy();
});

test('falls back to the configured category when the subcategory is not configured', () => {
    renderExpenseIcon({
        category: 'food',
        subcategory: 'unknown-subcategory',
    });

    expect(screen.getByTestId('category-icon').dataset.size).toBe('24');
    expect(screen.getByTestId('expense-icon').dataset.color).toBe(PROP_COLOR.warning);
    expect(screen.getByRole('img', { name: 'Food' })).toBeTruthy();
});

test('keeps the generic expense fallback when category metadata is absent', () => {
    renderExpenseIcon();

    expect(screen.getByTestId('generic-down-icon')).toBeTruthy();
    expect(screen.getByTestId('expense-icon').dataset.color).toBe(PROP_COLOR.debtOwing);
});

test('falls back safely for unknown category and subcategory values', () => {
    renderExpenseIcon({
        category: 'unknown-category',
        subcategory: 'unknown-subcategory',
        isCurrentUserPayer: true,
    });

    expect(screen.getByTestId('generic-up-icon')).toBeTruthy();
    expect(screen.getByTestId('expense-icon').dataset.color).toBe(PROP_COLOR.debtOwed);
});

test('uses category metadata for updated expenses', () => {
    renderExpenseIcon({
        action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
        category: 'food',
        subcategory: 'groceries',
    });

    expect(screen.getByTestId('subcategory-icon')).toBeTruthy();
    expect(screen.getByTestId('expense-icon').dataset.color).toBe(PROP_COLOR.success);
    expect(screen.getByRole('img', { name: 'Groceries' })).toBeTruthy();
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
    expect(screen.getByTestId('expense-icon').dataset.color).toBe(PROP_COLOR.danger);
    expect(screen.queryByRole('img', { name: 'Groceries' })).toBeNull();
});
