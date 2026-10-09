import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { Group } from 'api/chipin.types';
import {
    GROUP_CARD_FILTER_BUCKETS,
    GROUP_NET_CONVERSION_STATES,
} from 'constants/groups';
import { lightThemeStyled } from 'constants/styled-themes';
import type { GroupCardViewModel } from 'store/groupsSelectors';

import GroupCard from './GroupCard';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: { count?: number }) =>
            params?.count === undefined ? key : `${key}:${params.count}`,
    }),
}));

class LoadedTestImage {
    complete = true;
    naturalWidth = 1;
    src = '';

    addEventListener(): void {}

    removeEventListener(): void {}
}

beforeEach(() => {
    vi.stubGlobal('Image', LoadedTestImage);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

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

const group = {
    id: 'group-1',
    name: 'Vietnam',
    inviteToken: 'invite-token',
    description: null,
    creator,
    members: [{ user: creator, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: 'https://cdn.example.com/group-cover.webp',
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: { items: [], nextCursor: null },
} satisfies Group;

const createModel = (
    overrides: Partial<GroupCardViewModel> = {},
): GroupCardViewModel => ({
    group,
    isSettled: false,
    activeCurrencyCount: 1,
    sourceCurrencyBalance: { currency: 'USD', netBalance: 10 },
    netAmount: 10,
    netCurrency: 'USD',
    conversionState: GROUP_NET_CONVERSION_STATES.SAME_CURRENCY,
    filterBucket: GROUP_CARD_FILTER_BUCKETS.OWED,
    latestActivityAt: 1,
    isAutoHidden: false,
    ...overrides,
});

const renderCard = (
    model: GroupCardViewModel = createModel(),
    isSelected = false,
) =>
    render(
        <MemoryRouter>
            <ThemeProvider theme={lightThemeStyled}>
                <GroupCard model={model} isSelected={isSelected} />
            </ThemeProvider>
        </MemoryRouter>,
    );

test('uses the group cover only for the avatar', () => {
    const { container } = renderCard();

    return screen.findByRole('img', { name: group.name }).then(avatar => {
        expect(avatar).toHaveProperty('src', group.coverUrl);
        expect(container.querySelectorAll(`img[src="${group.coverUrl}"]`)).toHaveLength(1);
    });
});

test('shows the same dense selection outline for the card', () => {
    const { container } = renderCard(createModel(), true);
    const card = container.querySelector('[data-interactive-card]');

    expect(card).toBeTruthy();
    expect(card?.getAttribute('data-selected')).toBe('true');
    expect(getComputedStyle(card as HTMLElement).outlineStyle).toBe('solid');
    expect(getComputedStyle(card as HTMLElement).outlineWidth).toBe('2px');
});

test('renders the card without cover layers when the API cover is null', () => {
    const groupWithoutCover = { ...group, coverUrl: null } satisfies Group;
    const { container } = renderCard(
        createModel({ group: groupWithoutCover }),
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(group.name)).toBeTruthy();
});

test('DSH-001 shows approximate marker only when conversion was used', () => {
    const sameCurrency = renderCard(
        createModel({
            netAmount: 12.5,
            conversionState: GROUP_NET_CONVERSION_STATES.SAME_CURRENCY,
        }),
    );

    expect(sameCurrency.container.textContent).not.toContain('~');
    sameCurrency.unmount();

    const converted = renderCard(
        createModel({
            netAmount: 12.5,
            conversionState: GROUP_NET_CONVERSION_STATES.CONVERTED,
        }),
    );

    const amount = converted.container.querySelector('span[dir="ltr"]')?.parentElement;

    expect(amount?.textContent).toBe('~ 12.5 USD');
    expect(getComputedStyle(amount as HTMLElement).whiteSpace).toBe('nowrap');
});

test('DSH-001 keeps approximate markers ahead of tiny converted amounts', () => {
    const converted = renderCard(
        createModel({
            netAmount: 0.004,
            conversionState: GROUP_NET_CONVERSION_STATES.CONVERTED,
        }),
    );

    const amount = converted.container.querySelector('span[dir="ltr"]')?.parentElement;

    expect(amount?.textContent).toBe('~ < 0.01 USD');
    expect(getComputedStyle(amount as HTMLElement).whiteSpace).toBe('nowrap');
});

test('DSH-001 shows N/A when a required rate is unavailable', () => {
    renderCard(
        createModel({
            netAmount: null,
            conversionState: GROUP_NET_CONVERSION_STATES.UNAVAILABLE,
            filterBucket: GROUP_CARD_FILTER_BUCKETS.UNAVAILABLE,
        }),
    );

    expect(screen.getByText('groupsCard.unavailable')).toBeTruthy();
    expect(screen.getByRole('link').textContent).not.toContain('~');
});

test('DSH-001 announces source direction when conversion is unavailable', () => {
    renderCard(
        createModel({
            netAmount: null,
            sourceCurrencyBalance: { currency: 'EUR', netBalance: -8 },
            netCurrency: 'USD',
            conversionState: GROUP_NET_CONVERSION_STATES.UNAVAILABLE,
            filterBucket: GROUP_CARD_FILTER_BUCKETS.UNAVAILABLE,
        }),
    );

    expect(screen.getByText('groupsCard.unavailable')).toBeTruthy();
    expect(
        screen.getByRole('link', { name: /balances\.youOwe/ }),
    ).toBeTruthy();
});

test('DSH-001 shows a source-currency badge only for one non-default currency', () => {
    const oneCurrency = renderCard(
        createModel({
            sourceCurrencyBalance: { currency: 'VND', netBalance: 1_190_000 },
            conversionState: GROUP_NET_CONVERSION_STATES.CONVERTED,
        }),
    );

    expect(oneCurrency.container.textContent).toContain('1.19M VND');
    oneCurrency.unmount();

    const defaultCurrency = renderCard(createModel());

    expect(defaultCurrency.container.textContent).not.toContain('groupsCard.currencies');
});

test('DSH-001 summarizes multiple active currencies with a count badge', () => {
    renderCard(
        createModel({
            activeCurrencyCount: 2,
            sourceCurrencyBalance: null,
        }),
    );

    expect(screen.getByText('groupsCard.currencies:2')).toBeTruthy();
});

test('DSH-001 displays debt magnitude without a minus sign and uses summary formatting', () => {
    const rendered = renderCard(
        createModel({
            netAmount: -1_190_000,
            filterBucket: GROUP_CARD_FILTER_BUCKETS.OWES,
        }),
    );

    expect(rendered.container.textContent).toContain('1.19M USD');
    expect(rendered.container.textContent).not.toContain('-1.19M');
});

test('DSH-001 keeps tiny non-zero amounts and exposes debt direction without color', () => {
    const positive = renderCard(
        createModel({
            netAmount: 0.004,
            filterBucket: GROUP_CARD_FILTER_BUCKETS.OWED,
        }),
    );

    expect(positive.container.textContent).toContain('< 0.01 USD');
    expect(
        screen.getByRole('link', { name: /balances\.youAreOwed/ }),
    ).toBeTruthy();
    positive.unmount();

    const negative = renderCard(
        createModel({
            netAmount: -0.004,
            filterBucket: GROUP_CARD_FILTER_BUCKETS.OWES,
        }),
    );

    expect(negative.container.textContent).toContain('< 0.01 USD');
    expect(
        screen.getByRole('link', { name: /balances\.youOwe/ }),
    ).toBeTruthy();
    expect(negative.container.textContent).not.toContain('-0.01');
});

test('DSH-002 shows only the settled badge for groups without non-zero obligations', () => {
    const rendered = renderCard(
        createModel({
            isSettled: true,
            activeCurrencyCount: 0,
            sourceCurrencyBalance: null,
            netAmount: 0,
            filterBucket: GROUP_CARD_FILTER_BUCKETS.SETTLED,
        }),
    );

    expect(screen.getByText('groupsCard.settled')).toBeTruthy();
    expect(rendered.container.textContent).not.toContain('0 USD');
});
