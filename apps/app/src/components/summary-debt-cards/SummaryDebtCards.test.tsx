import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import SummaryDebtCards from './SummaryDebtCards';

import 'i18n/index';

const renderSummaryDebtCards = (showSettledEmptyState?: boolean) =>
    render(
        <Theme>
            <SummaryDebtCards
                owedToYouTotal={0}
                youOweTotal={0}
                owedEntries={[]}
                oweEntries={[]}
                defaultCurrency="USD"
                showSettledEmptyState={showSettledEmptyState}
            />
        </Theme>,
    );

test('preserves All settled by default for the GroupSummary consumer', () => {
    renderSummaryDebtCards();

    expect(screen.getByText('All settled')).toBeTruthy();
});

test('DSH-012 hides All settled when Dashboard has no groups', () => {
    renderSummaryDebtCards(false);

    expect(screen.queryByText('All settled')).toBeNull();
});
