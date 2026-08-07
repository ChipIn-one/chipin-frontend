import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import BalanceSummaryText from './BalanceSummaryText';

vi.mock('./numbers', () => ({
    Amount: ({ type, value }: { type?: string; value: number }) => (
        <span data-testid="summary-amount" data-type={type}>
            {value}
        </span>
    ),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('uses summary formatting for positive and negative balances', () => {
    render(
        <BalanceSummaryText
            entries={[
                { currency: 'USD', netBalance: 90_000 },
                { currency: 'VND', netBalance: -123_000 },
            ]}
            size="1"
        />,
    );

    const amounts = screen.getAllByTestId('summary-amount');

    expect(amounts).toHaveLength(2);
    for (const amount of amounts) {
        expect(amount.dataset.type).toBe('summary');
    }
});
