import { expect, test } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import type { BalanceEntry, BalancesMap } from 'api/chipin.raw.types';
import type { Group } from 'api/chipin.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';

import {
    GROUP_CARD_FILTER_BUCKETS,
    GROUP_DEBT_FILTERS,
    GROUP_NET_CONVERSION_STATES,
} from 'constants/groups';

import {
    selectGroupCardViewModel,
    selectGroupsCardsView,
} from './groupsSelectors';

const NOW = 2_000_000_000;
const DAY_SECONDS = 24 * 60 * 60;

const user = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const balance = (currency: string, netBalance: number): BalanceEntry => ({
    currency,
    netBalance,
});

const createGroup = ({
    id = 'group-1',
    name = 'Weekend Trip',
    balances = [{}],
    createdAt = NOW,
    activityAt,
}: {
    id?: string;
    name?: string;
    balances?: BalancesMap[];
    createdAt?: number;
    activityAt?: number;
} = {}): Group => {
    const event = {
        id: `${id}-activity`,
        seq: 1,
        domain: 'GROUP',
        action: ACTIVITY_ACTIONS.GROUP_CREATED,
        actorUserId: user.id,
        actorSnapshot: { displayName: user.displayName, picture: user.picture },
        subjectType: 'group',
        subjectId: id,
        groupId: id,
        metadata: { type: 'group', groupId: id, groupName: name },
        createdAt: activityAt ?? createdAt,
    } satisfies AppEvent;

    return {
        id,
        name,
        inviteToken: 'invite-token',
        description: null,
        creator: user,
        members: balances.map((balancesByCurrency, index) => ({
            user: {
                ...user,
                id: `user-${index + 1}`,
                email: `user-${index + 1}@example.com`,
            },
            balancesByCurrency,
        })),
        createdAt,
        updatedAt: createdAt,
        coverUrl: null,
        simplifyDebts: true,
        role: 'OWNER',
        status: 'ACTIVE',
        lastUsedCurrency: null,
        recentActivities: {
            items: activityAt === undefined ? [] : [{ parent: event, lastEvent: event }],
            nextCursor: null,
        },
    };
};

const getViewModel = (
    group: Group,
    options: {
        rates?: Record<string, number>;
        defaultCurrency?: string;
        nowTimestamp?: number;
    } = {},
) =>
    selectGroupCardViewModel(group, {
        rates: options.rates ?? {},
        baseCurrency: 'USD',
        defaultCurrency: options.defaultCurrency ?? 'USD',
        nowTimestamp: options.nowTimestamp ?? NOW,
    });

test('DSH-001/DSH-002 derives positive, negative, zero-unsettled and settled group nets', () => {
    const positive = getViewModel(
        createGroup({ balances: [{ USD: balance('USD', 20) }] }),
    );
    const negative = getViewModel(
        createGroup({ balances: [{ USD: balance('USD', -12) }] }),
    );
    const neutral = getViewModel(
        createGroup({
            balances: [
                { USD: balance('USD', 20) },
                { USD: balance('USD', -20) },
            ],
        }),
    );
    const settled = getViewModel(
        createGroup({ balances: [{ USD: balance('USD', 0) }] }),
    );

    expect(positive).toMatchObject({
        netAmount: 20,
        isSettled: false,
        filterBucket: GROUP_CARD_FILTER_BUCKETS.OWED,
    });
    expect(negative).toMatchObject({
        netAmount: -12,
        isSettled: false,
        filterBucket: GROUP_CARD_FILTER_BUCKETS.OWES,
    });
    expect(neutral).toMatchObject({
        netAmount: 0,
        isSettled: false,
        activeCurrencyCount: 1,
        filterBucket: GROUP_CARD_FILTER_BUCKETS.NEUTRAL,
    });
    expect(settled).toMatchObject({
        netAmount: 0,
        isSettled: true,
        activeCurrencyCount: 0,
        filterBucket: GROUP_CARD_FILTER_BUCKETS.SETTLED,
    });
});

test('DSH-001 normalizes backend-scale cancellation before classifying', () => {
    const neutral = getViewModel(
        createGroup({
            balances: [
                { USD: balance('USD', 0.1) },
                { USD: balance('USD', 0.2) },
                { USD: balance('USD', -0.3) },
            ],
        }),
    );

    expect(neutral).toMatchObject({
        netAmount: 0,
        isSettled: false,
        activeCurrencyCount: 1,
        sourceCurrencyBalance: { currency: 'USD', netBalance: 0 },
        filterBucket: GROUP_CARD_FILTER_BUCKETS.NEUTRAL,
    });
});

test('DSH-001 distinguishes same-currency, converted and unavailable totals', () => {
    const sameCurrency = getViewModel(
        createGroup({ balances: [{ USD: balance('USD', 25) }] }),
    );
    const converted = getViewModel(
        createGroup({ balances: [{ EUR: balance('EUR', 80) }] }),
        { rates: { EUR: 0.8 } },
    );
    const unavailable = getViewModel(
        createGroup({ balances: [{ EUR: balance('EUR', 80) }] }),
    );

    expect(sameCurrency).toMatchObject({
        netAmount: 25,
        conversionState: GROUP_NET_CONVERSION_STATES.SAME_CURRENCY,
    });
    expect(converted).toMatchObject({
        netAmount: 100,
        activeCurrencyCount: 1,
        sourceCurrencyBalance: { currency: 'EUR', netBalance: 80 },
        conversionState: GROUP_NET_CONVERSION_STATES.CONVERTED,
    });
    expect(unavailable).toMatchObject({
        netAmount: null,
        conversionState: GROUP_NET_CONVERSION_STATES.UNAVAILABLE,
        filterBucket: GROUP_CARD_FILTER_BUCKETS.UNAVAILABLE,
    });
});

test('DSH-001/DSH-003 normalizes cross-currency floating residue before classifying', () => {
    const neutral = getViewModel(
        createGroup({
            balances: [
                { USD: balance('USD', 0.1) },
                { EUR: balance('EUR', -0.07) },
            ],
        }),
        { rates: { EUR: 0.7 } },
    );

    expect(neutral).toMatchObject({
        netAmount: 0,
        isSettled: false,
        activeCurrencyCount: 2,
        conversionState: GROUP_NET_CONVERSION_STATES.CONVERTED,
        filterBucket: GROUP_CARD_FILTER_BUCKETS.NEUTRAL,
    });
});

test('DSH-001/DSH-003 preserves sub-cent converted nets for display and debt filters', () => {
    const positive = getViewModel(
        createGroup({ balances: [{ EUR: balance('EUR', 0.0032) }] }),
        { rates: { EUR: 0.8 } },
    );
    const negative = getViewModel(
        createGroup({ balances: [{ EUR: balance('EUR', -0.0032) }] }),
        { rates: { EUR: 0.8 } },
    );

    expect(positive.netAmount).toBeCloseTo(0.004);
    expect(positive.filterBucket).toBe(GROUP_CARD_FILTER_BUCKETS.OWED);
    expect(negative.netAmount).toBeCloseTo(-0.004);
    expect(negative.filterBucket).toBe(GROUP_CARD_FILTER_BUCKETS.OWES);
});

test('DSH-001 exposes one source currency and counts multiple active currencies', () => {
    const oneCurrency = getViewModel(
        createGroup({ balances: [{ VND: balance('VND', 2_590_000) }] }),
        { rates: { VND: 25_900 } },
    );
    const multipleCurrencies = getViewModel(
        createGroup({
            balances: [{ USD: balance('USD', 20), EUR: balance('EUR', -8) }],
        }),
        { rates: { EUR: 0.8 } },
    );

    expect(oneCurrency).toMatchObject({
        activeCurrencyCount: 1,
        sourceCurrencyBalance: { currency: 'VND', netBalance: 2_590_000 },
    });
    expect(multipleCurrencies).toMatchObject({
        activeCurrencyCount: 2,
        sourceCurrencyBalance: null,
    });
});

test('DSH-003 filters by final converted net and keeps zero-unsettled only in All groups', () => {
    const groups = [
        createGroup({
            id: 'positive',
            name: 'Vietnam',
            balances: [
                { USD: balance('USD', 20) },
                { USD: balance('USD', -5) },
            ],
        }),
        createGroup({
            id: 'neutral',
            name: 'Neutral',
            balances: [
                { USD: balance('USD', 20) },
                { USD: balance('USD', -20) },
            ],
        }),
        createGroup({
            id: 'negative',
            name: 'Bali',
            balances: [
                { USD: balance('USD', 3) },
                { USD: balance('USD', -8) },
            ],
        }),
    ];
    const baseOptions = {
        query: '',
        rates: {},
        baseCurrency: 'USD',
        defaultCurrency: 'USD',
        nowTimestamp: NOW,
    };

    expect(
        selectGroupsCardsView(groups, {
            ...baseOptions,
            filter: GROUP_DEBT_FILTERS.OWED,
        }).displayedGroups.map(model => model.group.id),
    ).toEqual(['positive']);
    expect(
        selectGroupsCardsView(groups, {
            ...baseOptions,
            filter: GROUP_DEBT_FILTERS.OWES,
        }).displayedGroups.map(model => model.group.id),
    ).toEqual(['negative']);
    expect(
        selectGroupsCardsView(groups, {
            ...baseOptions,
            filter: GROUP_DEBT_FILTERS.ALL,
        }).displayedGroups.map(model => model.group.id),
    ).toEqual(['positive', 'neutral', 'negative']);
});

test('DSH-003 excludes settled and unavailable groups from debt filters', () => {
    const groups = [
        createGroup({ id: 'settled' }),
        createGroup({
            id: 'missing-rate',
            balances: [{ EUR: balance('EUR', 10) }],
        }),
    ];
    const baseOptions = {
        query: '',
        rates: {},
        baseCurrency: 'USD',
        defaultCurrency: 'USD',
        nowTimestamp: NOW,
    };

    expect(
        selectGroupsCardsView(groups, {
            ...baseOptions,
            filter: GROUP_DEBT_FILTERS.OWED,
        }).displayedGroups,
    ).toEqual([]);
    expect(
        selectGroupsCardsView(groups, {
            ...baseOptions,
            filter: GROUP_DEBT_FILTERS.OWES,
        }).displayedGroups,
    ).toEqual([]);
});

test('DSH-004 uses the 15-day boundary, activity timestamp and createdAt fallback', () => {
    const exactly15Days = getViewModel(
        createGroup({ createdAt: NOW - 15 * DAY_SECONDS }),
    );
    const older = getViewModel(
        createGroup({ createdAt: NOW - 15 * DAY_SECONDS - 1 }),
    );
    const recentActivity = getViewModel(
        createGroup({
            createdAt: NOW - 30 * DAY_SECONDS,
            activityAt: NOW - 2 * DAY_SECONDS,
        }),
    );

    expect(exactly15Days).toMatchObject({
        latestActivityAt: NOW - 15 * DAY_SECONDS,
        isAutoHidden: false,
    });
    expect(older.isAutoHidden).toBe(true);
    expect(recentActivity).toMatchObject({
        latestActivityAt: NOW - 2 * DAY_SECONDS,
        isAutoHidden: false,
    });
});

test('DSH-004 keeps recent settled groups visible and moves only >15-day groups to the hidden section', () => {
    const groups = [
        createGroup({ id: 'new-settled', name: 'New settled' }),
        createGroup({
            id: 'boundary-settled',
            name: 'Boundary settled',
            createdAt: NOW - 15 * DAY_SECONDS,
        }),
        createGroup({
            id: 'old-settled',
            name: 'Old settled',
            createdAt: NOW - 15 * DAY_SECONDS - 1,
        }),
    ];

    const view = selectGroupsCardsView(groups, {
        filter: GROUP_DEBT_FILTERS.ALL,
        query: '',
        rates: {},
        baseCurrency: 'USD',
        defaultCurrency: 'USD',
        nowTimestamp: NOW,
    });

    expect(view.displayedGroups.map(model => model.group.id)).toEqual([
        'new-settled',
        'boundary-settled',
    ]);
    expect(view.hiddenSettledGroups.map(model => model.group.id)).toEqual([
        'old-settled',
    ]);
    expect(view.settledCount).toBe(1);
});

test('DSH-004 never auto-hides a group with active debt because of age', () => {
    const activeDebt = getViewModel(
        createGroup({
            createdAt: NOW - 30 * DAY_SECONDS,
            balances: [{ USD: balance('USD', 1) }],
        }),
    );

    expect(activeDebt).toMatchObject({
        isSettled: false,
        isAutoHidden: false,
    });
});

test('DSH-003 keeps a selected active group visible in source order across debt filters', () => {
    const groups = [
        createGroup({
            id: 'owes-first',
            balances: [{ USD: balance('USD', -8) }],
        }),
        createGroup({
            id: 'selected-owed',
            balances: [{ USD: balance('USD', 5) }],
        }),
        createGroup({
            id: 'owes-last',
            balances: [{ USD: balance('USD', -3) }],
        }),
    ];

    const view = selectGroupsCardsView(groups, {
        filter: GROUP_DEBT_FILTERS.OWES,
        query: '',
        selectedGroupId: 'selected-owed',
        rates: {},
        baseCurrency: 'USD',
        defaultCurrency: 'USD',
        nowTimestamp: NOW,
    });

    expect(view.displayedGroups.map(model => model.group.id)).toEqual([
        'owes-first',
        'selected-owed',
        'owes-last',
    ]);
});

test('DSH-003 keeps a selected settled group visible across debt filters', () => {
    const groups = [
        createGroup({
            id: 'owed-first',
            balances: [{ USD: balance('USD', 8) }],
        }),
        createGroup({
            id: 'selected-settled-filter',
            name: 'Selected settled filter',
            createdAt: NOW - 30 * DAY_SECONDS,
        }),
        createGroup({
            id: 'owed-last',
            balances: [{ USD: balance('USD', 3) }],
        }),
    ];

    const view = selectGroupsCardsView(groups, {
        filter: GROUP_DEBT_FILTERS.OWED,
        query: '',
        selectedGroupId: 'selected-settled-filter',
        rates: {},
        baseCurrency: 'USD',
        defaultCurrency: 'USD',
        nowTimestamp: NOW,
    });

    expect(view.displayedGroups.map(model => model.group.id)).toEqual([
        'owed-first',
        'selected-settled-filter',
        'owed-last',
    ]);
});

test('DSH-003/DSH-004 keeps selected settled groups in source position without prepending', () => {
    const groups = [
        createGroup({
            id: 'active-first',
            balances: [{ USD: balance('USD', 10) }],
        }),
        createGroup({
            id: 'selected-settled',
            name: 'Selected settled',
            createdAt: NOW - 30 * DAY_SECONDS,
        }),
        createGroup({
            id: 'active-last',
            balances: [{ USD: balance('USD', -2) }],
        }),
    ];

    const view = selectGroupsCardsView(groups, {
        filter: GROUP_DEBT_FILTERS.ALL,
        query: '',
        selectedGroupId: 'selected-settled',
        rates: {},
        baseCurrency: 'USD',
        defaultCurrency: 'USD',
        nowTimestamp: NOW,
    });

    expect(view.displayedGroups.map(model => model.group.id)).toEqual([
        'active-first',
        'selected-settled',
        'active-last',
    ]);
});

test('DSH-004/DSH-005 search surfaces an auto-hidden settled group', () => {
    const groups = [
        createGroup({
            id: 'active',
            name: 'Vietnam',
            balances: [{ USD: balance('USD', 10) }],
        }),
        createGroup({
            id: 'old-settled',
            name: 'Old Thailand',
            createdAt: NOW - 30 * DAY_SECONDS,
        }),
    ];
    const baseOptions = {
        filter: GROUP_DEBT_FILTERS.ALL,
        rates: {},
        baseCurrency: 'USD',
        defaultCurrency: 'USD',
        nowTimestamp: NOW,
    };

    const collapsed = selectGroupsCardsView(groups, {
        ...baseOptions,
        query: '',
    });

    expect(collapsed.displayedGroups.map(model => model.group.id)).toEqual(['active']);
    expect(collapsed.hiddenSettledGroups.map(model => model.group.id)).toEqual([
        'old-settled',
    ]);

    expect(
        selectGroupsCardsView(groups, {
            ...baseOptions,
            query: 'thailand',
        }).displayedGroups.map(model => model.group.id),
    ).toEqual(['old-settled']);
});

test('DSH-005 composes search with the active debt filter', () => {
    const groups = [
        createGroup({
            id: 'owed-trip',
            name: 'Vietnam trip',
            balances: [{ USD: balance('USD', 5) }],
        }),
        createGroup({
            id: 'owes-trip',
            name: 'Vietnam work',
            balances: [{ USD: balance('USD', -5) }],
        }),
        createGroup({
            id: 'owed-home',
            name: 'Home',
            balances: [{ USD: balance('USD', 10) }],
        }),
    ];

    const view = selectGroupsCardsView(groups, {
        filter: GROUP_DEBT_FILTERS.OWED,
        query: 'vietnam',
        rates: {},
        baseCurrency: 'USD',
        defaultCurrency: 'USD',
        nowTimestamp: NOW,
    });

    expect(view.displayedGroups.map(model => model.group.id)).toEqual(['owed-trip']);
});
