import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

import type { Money } from 'shared/money';
import { currencyCode } from 'shared/money';

import CurrencyGroupCard from './CurrencyGroupCard';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

// `units` ledger units (10⁻⁴).
const money = (units: bigint, currency = 'USD'): Money => ({
    minor: units,
    currency: currencyCode(currency),
});

const renderInTheme = (children: ReactNode) => render(<Theme>{children}</Theme>);

test('shows a zero currency total as settled up instead of owed', () => {
    renderInTheme(<CurrencyGroupCard currency="USD" net={money(0n)} friends={[]} />);

    expect(screen.getAllByText('balances.settledUp').length).toBeGreaterThan(0);
    expect(screen.queryByText('balances.youAreOwed')).toBeNull();
    expect(screen.getByText('USD').getAttribute('data-accent-color')).toBe('gray');
});

test('keeps positive and negative currency totals directional', () => {
    const { unmount } = renderInTheme(
        <CurrencyGroupCard currency="USD" net={money(50_000n)} friends={[]} />,
    );

    expect(screen.getAllByText('balances.youAreOwed').length).toBeGreaterThan(0);
    unmount();

    renderInTheme(<CurrencyGroupCard currency="EUR" net={money(-50_000n, 'EUR')} friends={[]} />);

    expect(screen.getAllByText('balances.youOwe').length).toBeGreaterThan(0);
});

test('shows a debt below one minor unit as a debt, not settled', () => {
    renderInTheme(<CurrencyGroupCard currency="USD" net={money(40n)} friends={[]} />);

    expect(screen.getAllByText('balances.youAreOwed').length).toBeGreaterThan(0);
    expect(screen.queryByText('balances.settledUp')).toBeNull();
});
