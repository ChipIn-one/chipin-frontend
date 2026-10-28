import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

import CurrencyGroupCard from './CurrencyGroupCard';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const renderInTheme = (children: ReactNode) => render(<Theme>{children}</Theme>);

test('shows a zero currency total as settled up instead of owed', () => {
    renderInTheme(<CurrencyGroupCard currency="USD" netBalance={0} friends={[]} />);

    expect(screen.getAllByText('balances.settledUp').length).toBeGreaterThan(0);
    expect(screen.queryByText('balances.youAreOwed')).toBeNull();
    expect(screen.getByText('USD').getAttribute('data-accent-color')).toBe('gray');
});

test('keeps positive and negative currency totals directional', () => {
    const { unmount } = renderInTheme(
        <CurrencyGroupCard currency="USD" netBalance={5} friends={[]} />,
    );

    expect(screen.getAllByText('balances.youAreOwed').length).toBeGreaterThan(0);
    unmount();

    renderInTheme(<CurrencyGroupCard currency="EUR" netBalance={-5} friends={[]} />);

    expect(screen.getAllByText('balances.youOwe').length).toBeGreaterThan(0);
});
