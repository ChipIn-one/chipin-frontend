import { expect, test } from 'vitest';

import { selectDashboardSummary, selectIsSoloMode } from './dashboardSelectors';
import { APP_MODES, useDashboardStore } from './dashboardStore';

test('selects whether the active app mode is Solo', () => {
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    expect(selectIsSoloMode(useDashboardStore.getState())).toBe(false);

    useDashboardStore.setState({ appMode: APP_MODES.SOLO });
    expect(selectIsSoloMode(useDashboardStore.getState())).toBe(true);
});

test('derives converted dashboard totals from confirmed dashboard balances and rates', () => {
    useDashboardStore.setState({
        balances: {
            USD: { currency: 'USD', netBalance: 20 },
            EUR: { currency: 'EUR', netBalance: -9 },
        },
        currencies: {
            base: 'USD',
            timestamp: 1,
            fetchedAt: 1,
            stale: false,
            rates: { USD: 1, EUR: 0.9 },
        },
    });

    expect(selectDashboardSummary(useDashboardStore.getState(), 'USD')).toEqual({
        owedEntries: [{ currency: 'USD', netBalance: 20 }],
        oweEntries: [{ currency: 'EUR', netBalance: -9 }],
        netTotalInBase: 10,
        owedTotalInBase: 20,
        owingTotalInBase: 10,
    });
});
