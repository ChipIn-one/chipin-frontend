import { expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

import TotalBalanceCard from './TotalBalanceCard';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('renders a negative dashboard total without a minus sign', () => {
    render(
        <Theme>
            <TotalBalanceCard
                isLoading={false}
                netTotalInBase={-12.5}
                defaultCurrency="USD"
            />
        </Theme>,
    );

    expect(screen.getByText('13 USD')).toBeTruthy();
    expect(screen.queryByText('-13 USD')).toBeNull();
    expect(screen.getByText('balances.youOwe')).toBeTruthy();
});
