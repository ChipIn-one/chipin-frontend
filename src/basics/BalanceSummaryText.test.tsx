import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import BalanceSummaryText from './BalanceSummaryText';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('renders a positive fractional balance with two-decimal summary precision', () => {
    render(
        <BalanceSummaryText
            entries={[{ currency: 'USD', netBalance: 1.5 }]}
            size="1"
        />,
    );

    expect(screen.getByText('balances.youAreOwed')).toBeTruthy();
    expect(screen.getByText('1.5 USD')).toBeTruthy();
});

test('renders a negative fractional balance with two-decimal summary precision', () => {
    render(
        <BalanceSummaryText entries={[{ currency: 'USD', netBalance: -1.5 }]} size="1" />,
    );

    expect(screen.getByText('balances.youOwe')).toBeTruthy();
    expect(screen.getByText('1.5 USD')).toBeTruthy();
});

test('rounds balances beyond two decimals with the existing amount formatter', () => {
    render(
        <BalanceSummaryText entries={[{ currency: 'USD', netBalance: 2.675 }]} size="1" />,
    );

    expect(screen.getByText('2.68 USD')).toBeTruthy();
});

test('keeps integer balance summaries visually unchanged', () => {
    render(
        <BalanceSummaryText
            entries={[
                { currency: 'USD', netBalance: 90_000 },
                { currency: 'VND', netBalance: -123_000 },
            ]}
            size="1"
        />,
    );

    expect(screen.getByText('90.00K USD')).toBeTruthy();
    expect(screen.getByText('123.00K VND')).toBeTruthy();
});
