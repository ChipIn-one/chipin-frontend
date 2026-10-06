import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AppEvent } from 'api/activity.types';
import type { BalanceEntry, BalancesMap } from 'api/chipin.raw.types';
import type { Group, SelfUser } from 'api/chipin.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { lightThemeStyled } from 'constants/styled-themes';
import { useDashboardStore } from 'store/dashboardStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import GroupsCards from './GroupsCards';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (
            key: string,
            params?: { count?: number; query?: string },
        ) => {
            if (params?.count !== undefined) {
                return `${key}:${params.count}`;
            }

            if (params?.query !== undefined) {
                return `${key}:${params.query}`;
            }

            return key;
        },
    }),
}));

vi.mock('./group-card', () => ({
    GroupCard: ({
        model,
    }: {
        model: { group: Group; netAmount: number | null };
    }) => (
        <div
            data-testid="group-card"
            data-group-id={model.group.id}
            data-net={model.netAmount ?? 'na'}
        >
            {model.group.name}
        </div>
    ),
}));

vi.mock('./modals', () => ({
    CreateUpdateGroupModal: ({ children }: { children: React.ReactNode }) => children,
}));

const NOW = 2_000_000_000;
const DAY_SECONDS = 24 * 60 * 60;

const creator = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const currentUser = {
    ...creator,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '12h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
} satisfies SelfUser;

const balance = (currency: string, netBalance: number): BalanceEntry => ({
    currency,
    netBalance,
});

const createGroup = ({
    id,
    name,
    balances = [{}],
    createdAt = NOW,
    activityAt,
}: {
    id: string;
    name: string;
    balances?: BalancesMap[];
    createdAt?: number;
    activityAt?: number;
}): Group => {
    const activity = {
        id: `${id}-activity`,
        seq: 1,
        domain: 'GROUP',
        action: ACTIVITY_ACTIONS.GROUP_CREATED,
        actorUserId: creator.id,
        actorSnapshot: {
            displayName: creator.displayName,
            picture: creator.picture,
        },
        subjectType: 'group',
        subjectId: id,
        groupId: id,
        metadata: {
            type: 'group',
            groupId: id,
            groupName: name,
        },
        createdAt: activityAt ?? createdAt,
    } satisfies AppEvent;

    return {
        id,
        name,
        inviteToken: `invite-${id}`,
        description: null,
        creator,
        members: balances.map((balancesByCurrency, index) => ({
            user: {
                ...creator,
                id: `${id}-user-${index}`,
                email: `${id}-user-${index}@example.com`,
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
            items:
                activityAt === undefined
                    ? []
                    : [{ parent: activity, lastEvent: activity }],
            nextCursor: null,
        },
    };
};

const renderGroups = (groups: Group[], selectedGroupId?: string) =>
    render(
        <MemoryRouter>
            <ThemeProvider theme={lightThemeStyled}>
                <GroupsCards
                    groups={groups}
                    label="Groups"
                    selectedGroupId={selectedGroupId}
                />
            </ThemeProvider>
        </MemoryRouter>,
    );

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW * 1000);

    useLoadingStore.getState().setInitialLoadingStore();
    useLoadingStore.getState().setLoading('group', 'list', 'fetched');
    useLoadingStore.getState().setLoading('dashboard', 'data', 'fetched');
    useDashboardStore.getState().setInitialDashboardStore();
    useDashboardStore.setState({
        currencies: {
            base: 'USD',
            timestamp: NOW,
            fetchedAt: NOW,
            stale: false,
            rates: { EUR: 0.8, VND: 25_900 },
        },
    });
    useUsersStore.setState({ user: currentUser });
});

afterEach(() => {
    vi.useRealTimers();
});

test('DSH-003 filters mixed-direction groups by their final group net', () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const positive = createGroup({
        id: 'positive',
        name: 'Positive',
        balances: [
            { USD: balance('USD', 20) },
            { USD: balance('USD', -5) },
        ],
    });
    const neutral = createGroup({
        id: 'neutral',
        name: 'Neutral',
        balances: [
            { USD: balance('USD', 20) },
            { USD: balance('USD', -20) },
        ],
    });
    const negative = createGroup({
        id: 'negative',
        name: 'Negative',
        balances: [
            { USD: balance('USD', 5) },
            { USD: balance('USD', -20) },
        ],
    });

    renderGroups([positive, neutral, negative]);

    return user
        .click(screen.getByRole('button', { name: 'summary.owedToYou' }))
        .then(() => {
            expect(screen.getByText('Positive')).toBeTruthy();
            expect(screen.queryByText('Neutral')).toBeNull();
            expect(screen.queryByText('Negative')).toBeNull();

            return user.click(screen.getByRole('button', { name: 'summary.youOwe' }));
        })
        .then(() => {
            expect(screen.queryByText('Positive')).toBeNull();
            expect(screen.queryByText('Neutral')).toBeNull();
            expect(screen.getByText('Negative')).toBeTruthy();
        });
});

test('DSH-004 keeps recent settled groups visible and collapses only >15-day inactive groups', () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const active = createGroup({
        id: 'active',
        name: 'Active',
        balances: [{ USD: balance('USD', 10) }],
    });
    const recentSettled = createGroup({
        id: 'recent-settled',
        name: 'Recent settled',
    });
    const oldSettled = createGroup({
        id: 'old-settled',
        name: 'Old settled',
        createdAt: NOW - 30 * DAY_SECONDS,
    });

    renderGroups([active, recentSettled, oldSettled]);

    expect(screen.getByText('Recent settled')).toBeTruthy();
    expect(screen.queryByText('Old settled')).toBeNull();
    expect(screen.getByText('groups.settledAutoHide')).toBeTruthy();
    expect(screen.getByText('groups.settledCount:1')).toBeTruthy();

    return user
        .click(screen.getByRole('button', { name: /groups.showSettled/ }))
        .then(() => {
            const hiddenGroup = screen.getByText('Old settled');
            const hideButton = screen.getByRole('button', { name: /groups.hideSettled/ });

            expect(
                hideButton.compareDocumentPosition(hiddenGroup) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();

            return user.click(screen.getByRole('button', { name: 'summary.owedToYou' }));
        })
        .then(() => {
            expect(screen.queryByText('Recent settled')).toBeNull();
            expect(screen.queryByText('Old settled')).toBeNull();
            expect(
                screen.queryByRole('button', { name: /groups.hideSettled/ }),
            ).toBeNull();
        });
});

test('DSH-004/DSH-005 search surfaces an auto-hidden settled group', () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const active = createGroup({
        id: 'active',
        name: 'Vietnam',
        balances: [{ USD: balance('USD', 10) }],
    });
    const oldSettled = createGroup({
        id: 'old',
        name: 'Archive Thailand',
        createdAt: NOW - 30 * DAY_SECONDS,
    });

    renderGroups([active, oldSettled]);

    expect(screen.queryByText('Archive Thailand')).toBeNull();

    return user
        .click(screen.getByRole('button', { name: 'groups.searchLabel' }))
        .then(() =>
            user.type(
                screen.getByRole('textbox', { name: 'groups.searchLabel' }),
                'Thailand',
            ),
        )
        .then(() => {
            expect(screen.getByText('Archive Thailand')).toBeTruthy();
            expect(screen.queryByText('Vietnam')).toBeNull();
        });
});

test('DSH-005 preserves the query after blur and clears it explicitly', () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const vietnam = createGroup({
        id: 'vietnam',
        name: 'Vietnam',
        balances: [{ USD: balance('USD', 10) }],
    });
    const bali = createGroup({
        id: 'bali',
        name: 'Bali',
        balances: [{ USD: balance('USD', 5) }],
    });

    renderGroups([vietnam, bali]);

    return user
        .click(screen.getByRole('button', { name: 'groups.searchLabel' }))
        .then(() =>
            user.type(
                screen.getByRole('textbox', { name: 'groups.searchLabel' }),
                'Vietnam',
            ),
        )
        .then(() => {
            expect(screen.queryByText('Bali')).toBeNull();
            return user.click(
                screen.getByRole('button', { name: 'common:buttons.createGroup' }),
            );
        })
        .then(() => {
            const collapsedSearch = screen.getByRole('button', {
                name: 'groups.searchActiveLabel:Vietnam',
            });

            expect(collapsedSearch.getAttribute('data-query-active')).toBe('true');
            expect(
                screen.queryByRole('textbox', { name: 'groups.searchLabel' }),
            ).toBeNull();

            return user.click(collapsedSearch);
        })
        .then(() => {
            const input = screen.getByRole('textbox', {
                name: 'groups.searchLabel',
            }) as HTMLInputElement;

            expect(input.value).toBe('Vietnam');
            return user.click(
                screen.getByRole('button', { name: 'groups.clearSearch' }),
            );
        })
        .then(() => {
            expect(screen.getByText('Vietnam')).toBeTruthy();
            expect(screen.getByText('Bali')).toBeTruthy();
        });
});

test('DSH-005 composes search with the selected debt filter', () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const owedVietnam = createGroup({
        id: 'owed-vietnam',
        name: 'Vietnam trip',
        balances: [{ USD: balance('USD', 5) }],
    });
    const owesVietnam = createGroup({
        id: 'owes-vietnam',
        name: 'Vietnam work',
        balances: [{ USD: balance('USD', -5) }],
    });
    const owedHome = createGroup({
        id: 'owed-home',
        name: 'Home',
        balances: [{ USD: balance('USD', 10) }],
    });

    renderGroups([owedVietnam, owesVietnam, owedHome]);

    return user
        .click(screen.getByRole('button', { name: 'summary.owedToYou' }))
        .then(() =>
            user.click(screen.getByRole('button', { name: 'groups.searchLabel' })),
        )
        .then(() =>
            user.type(
                screen.getByRole('textbox', { name: 'groups.searchLabel' }),
                'Vietnam',
            ),
        )
        .then(() => {
            expect(screen.getByText('Vietnam trip')).toBeTruthy();
            expect(screen.queryByText('Vietnam work')).toBeNull();
            expect(screen.queryByText('Home')).toBeNull();
        });
});

test('DSH-003 keeps a selected settled group in backend order without prepending', () => {
    const activeFirst = createGroup({
        id: 'first',
        name: 'First',
        balances: [{ USD: balance('USD', 10) }],
    });
    const selectedSettled = createGroup({
        id: 'selected',
        name: 'Selected',
    });
    const activeLast = createGroup({
        id: 'last',
        name: 'Last',
        balances: [{ USD: balance('USD', -5) }],
    });

    renderGroups([activeFirst, selectedSettled, activeLast], selectedSettled.id);

    expect(
        screen
            .getAllByTestId('group-card')
            .map(element => element.getAttribute('data-group-id')),
    ).toEqual(['first', 'selected', 'last']);
});

test('uses one full-width thick settled toggle with state chevrons', () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const oldSettled = createGroup({
        id: 'old-settled-control',
        name: 'Old settled control',
        createdAt: NOW - 30 * DAY_SECONDS,
    });

    renderGroups([oldSettled]);

    const toggle = screen.getByRole('button', { name: /groups.showSettled/ });
    expect(toggle.textContent).toContain('groups.settledCount:1');
    expect(toggle.textContent).toContain('groups.showSettled');
    expect(getComputedStyle(toggle).width).toBe('100%');
    expect(toggle.className).toContain('rt-r-size-3');
    expect(toggle.querySelector('.lucide-chevron-down')).not.toBeNull();
    expect(toggle.querySelector('.lucide-chevron-up')).toBeNull();

    return user.click(toggle).then(() => {
        expect(
            screen.getByRole('button', { name: /groups.hideSettled/ })
                .querySelector('.lucide-chevron-up'),
        ).not.toBeNull();
    });
});


test('uses matching highlighted header actions', () => {
    const group = createGroup({
        id: 'header-actions',
        name: 'Header actions',
        balances: [{ USD: balance('USD', 1) }],
    });

    renderGroups([group]);

    const search = screen.getByRole('button', { name: 'groups.searchLabel' });
    const create = screen.getByRole('button', { name: 'common:buttons.createGroup' });

    expect(search.className).toContain('rt-variant-soft');
    expect(create.className).toContain('rt-variant-soft');
    expect(getComputedStyle(search).padding).toBe(getComputedStyle(create).padding);
});


test('keeps clear search keyboard-accessible before collapsing on focus exit', () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const vietnam = createGroup({
        id: 'keyboard-search',
        name: 'Vietnam keyboard',
        balances: [{ USD: balance('USD', 10) }],
    });

    renderGroups([vietnam]);

    return user
        .click(screen.getByRole('button', { name: 'groups.searchLabel' }))
        .then(() =>
            user.type(
                screen.getByRole('textbox', { name: 'groups.searchLabel' }),
                'Vietnam',
            ),
        )
        .then(() => user.tab())
        .then(() => {
            const clearButton = screen.getByRole('button', {
                name: 'groups.clearSearch',
            });

            expect(document.activeElement).toBe(clearButton);
            expect(
                screen.getByRole('textbox', { name: 'groups.searchLabel' }),
            ).toBeTruthy();

            return user.keyboard('{Enter}');
        })
        .then(() => {
            const input = screen.getByRole('textbox', {
                name: 'groups.searchLabel',
            });

            expect(input).toBeTruthy();
            expect(document.activeElement).toBe(input);
        });
});


test('announces retained search state after collapse', () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const vietnam = createGroup({
        id: 'retained-search',
        name: 'Vietnam retained',
        balances: [{ USD: balance('USD', 10) }],
    });

    renderGroups([vietnam]);

    return user
        .click(screen.getByRole('button', { name: 'groups.searchLabel' }))
        .then(() =>
            user.type(
                screen.getByRole('textbox', { name: 'groups.searchLabel' }),
                'Vietnam',
            ),
        )
        .then(() =>
            user.click(
                screen.getByRole('button', { name: 'common:buttons.createGroup' }),
            ),
        )
        .then(() => {
            expect(
                screen.getByRole('button', {
                    name: 'groups.searchActiveLabel:Vietnam',
                }),
            ).toBeTruthy();
        });
});

test('uses search-specific and filter-specific empty-state descriptions', () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const owed = createGroup({
        id: 'empty-copy',
        name: 'Vietnam',
        balances: [{ USD: balance('USD', 10) }],
    });

    renderGroups([owed]);

    return user
        .click(screen.getByRole('button', { name: 'summary.youOwe' }))
        .then(() => {
            const emptyDescription = screen.getByText(
                'groups.filterEmptyDescription',
            );
            const emptyCard = emptyDescription.closest(
                '[data-empty-state-density="groupCard"]',
            );

            expect(emptyCard).toBeTruthy();
            expect(
                screen.queryByText('groups.searchEmptyDescription'),
            ).toBeNull();

            return user.click(
                screen.getByRole('button', { name: 'groups.searchLabel' }),
            );
        })
        .then(() =>
            user.type(
                screen.getByRole('textbox', { name: 'groups.searchLabel' }),
                'missing',
            ),
        )
        .then(() => {
            expect(screen.getByText('groups.searchEmptyDescription')).toBeTruthy();
            expect(screen.queryByText('groups.filterEmptyDescription')).toBeNull();
        });
});


test('returns focus to the search trigger on Escape', () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const group = createGroup({
        id: 'escape-search',
        name: 'Escape search',
        balances: [{ USD: balance('USD', 1) }],
    });

    renderGroups([group]);

    return user
        .click(screen.getByRole('button', { name: 'groups.searchLabel' }))
        .then(() => {
            const input = screen.getByRole('textbox', {
                name: 'groups.searchLabel',
            });

            expect(document.activeElement).toBe(input);
            return user.keyboard('{Escape}');
        })
        .then(() => {
            const searchButton = screen.getByRole('button', {
                name: 'groups.searchLabel',
            });

            expect(
                screen.queryByRole('textbox', { name: 'groups.searchLabel' }),
            ).toBeNull();
            expect(document.activeElement).toBe(searchButton);
        });
});
