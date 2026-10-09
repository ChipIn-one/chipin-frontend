import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';

import SummaryDebtCards from './SummaryDebtCards';

import 'i18n/index';

const renderSummaryDebtCards = (showSettledEmptyState?: boolean) =>
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <Theme>
                <SummaryDebtCards
                    owedToYouTotal={0}
                    youOweTotal={0}
                    owedEntries={[]}
                    oweEntries={[]}
                    defaultCurrency="USD"
                    showSettledEmptyState={showSettledEmptyState}
                />
            </Theme>
        </ThemeProvider>,
    );

test('preserves All settled by default for the GroupSummary consumer', () => {
    renderSummaryDebtCards();

    expect(screen.getByText('All settled')).toBeTruthy();
});

test('DSH-012 hides All settled when Dashboard has no groups', () => {
    renderSummaryDebtCards(false);

    expect(screen.queryByText('All settled')).toBeNull();
});
