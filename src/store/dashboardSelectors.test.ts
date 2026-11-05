import { expect, test } from 'vitest';

import type { BalanceEntry } from 'api/chipin.raw.types';

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

test('keeps non-zero dashboard entries and drops float-noise zero balances', () => {
    useDashboardStore.setState({
        balances: {
            USD: { currency: 'USD', netBalance: 20.5 },
            EUR: { currency: 'EUR', netBalance: -9.25 },
            GBP: { currency: 'GBP', netBalance: 5.5e-17 },
            JPY: { currency: 'JPY', netBalance: -0.00004 },
            CHF: { currency: 'CHF', netBalance: 0.004 },
        },
        currencies: {
            base: 'USD',
            timestamp: 1,
            fetchedAt: 1,
            stale: false,
            rates: { USD: 1, EUR: 1, GBP: 1, JPY: 1, CHF: 1 },
        },
    });

    const summary = selectDashboardSummary(useDashboardStore.getState(), 'USD');

    expect(summary.owedEntries).toEqual([
        { currency: 'USD', netBalance: 20.5 },
        { currency: 'CHF', netBalance: 0.004 },
    ]);
    expect(summary.oweEntries).toEqual([{ currency: 'EUR', netBalance: -9.25 }]);
});

test('skips invalid legacy balances and an invalid default currency without throwing', () => {
    // Bad runtime input the legacy DTO types do not admit (`JSON.parse` carries anything).
    const unsafe = (currency: unknown, netBalance: unknown) =>
        ({ currency, netBalance }) as unknown as BalanceEntry;

    useDashboardStore.setState({
        balances: {
            USD: { currency: 'USD', netBalance: 3 },
            A: unsafe('', 1),
            B: unsafe('US', 1),
            C: unsafe('EURO', 1),
            D: unsafe(null, 1),
            E: unsafe('EUR', Number.POSITIVE_INFINITY),
            F: unsafe('EUR', null),
        },
        currencies: {
            base: 'USD',
            timestamp: 1,
            fetchedAt: 1,
            stale: false,
            rates: { EUR: 0.9 },
        },
    });

    expect(selectDashboardSummary(useDashboardStore.getState(), 'nope')).toEqual({
        owedEntries: [{ currency: 'USD', netBalance: 3 }],
        oweEntries: [],
        netTotalInBase: 3,
        owedTotalInBase: 3,
        owingTotalInBase: 0,
    });
});
