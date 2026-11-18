// Issue #727: in Russian the debtor's balance line starts with a capital letter, like the
// creditor's line. Renders with the real Russian resources (the sibling test mocks i18n).
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { i18n } from 'i18n';

import BalanceSummaryText from './BalanceSummaryText';

beforeEach(async () => {
    await act(() => i18n.changeLanguage('ru'));
});

afterEach(() => i18n.changeLanguage('en'));

test('the Russian debtor line starts with a capital letter', () => {
    render(
        <BalanceSummaryText
            balances={{ owed: [], owe: [{ currency: 'USD', netBalance: -15 }] }}
            size="1"
        />,
    );

    expect(screen.getByText(/^Вы должны/)).toBeTruthy();
});

test('the Russian creditor line starts with a capital letter', () => {
    render(
        <BalanceSummaryText
            balances={{ owed: [{ currency: 'USD', netBalance: 15 }], owe: [] }}
            size="1"
        />,
    );

    expect(screen.getByText(/^Вам должны/)).toBeTruthy();
});
