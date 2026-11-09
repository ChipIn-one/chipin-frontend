import * as Sentry from '@sentry/react';
import { beforeEach, expect, test, vi } from 'vitest';

import type { components } from 'shared/api/generated/schema';
import { createWireAmount, currencyCode, fromUnits } from 'shared/money';

import { expenseBalanceChange } from './expenseBalanceChange';
import { toActivityEventWith, toActivityItem, toActivityItems } from './toActivityItem';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

type WireEvent = components['schemas']['ActivityEventResponse'];
type WireMetadata = NonNullable<WireEvent['metadata']>;

beforeEach(() => {
    vi.mocked(Sentry.captureMessage).mockClear();
});

const money = (minor: bigint, currency = 'USD') => fromUnits(minor, currencyCode(currency));

const wireEvent = (
    id: string,
    action: WireEvent['action'],
    metadata: WireMetadata | null,
): WireEvent => ({
    id,
    seq: 2,
    domain: 'LEDGER',
    action,
    actorUserId: 'u1',
    actorSnapshot: { displayName: 'Ann', picture: null },
    subjectType: 'expense',
    subjectId: 'entry-1',
    groupId: 'g1',
    createdAt: 1_700_000_000,
    parentActivityId: null,
    metadata,
});

const expense = (amount: string, currency = 'EUR', shares: [string, string][] = []) =>
    ({
        type: 'expense',
        entryId: 'entry-1',
        groupId: 'g1',
        groupName: 'Trip',
        description: 'Dinner',
        amount: createWireAmount(amount),
        currency,
        payerId: 'u1',
        payerDisplayName: 'Ann',
        sharingMode: null,
        fieldDiffs: [],
        shares: shares.map(([userId, share]) => ({
            userId,
            displayName: userId,
            shareAmount: createWireAmount(share),
            currency,
        })),
    }) satisfies WireMetadata;

const settlement = (amount: string, currency: string) =>
    ({
        type: 'settlement',
        entryId: 'entry-2',
        amount: createWireAmount(amount),
        currency,
        payerId: 'u2',
        fromDisplayName: 'Bob',
        toDisplayName: 'Ann',
    }) satisfies WireMetadata;

const preview = (parent: WireEvent, lastEvent: WireEvent = parent) => ({ parent, lastEvent });

test('ACT-021 maps an expense chain to Money, exactly and with the domain fields only', () => {
    const item = toActivityItem(
        preview(
            wireEvent('p1', 'EXPENSE_CREATED', expense('10', 'EUR', [['u2', '3.3333']])),
            wireEvent('p1-2', 'EXPENSE_UPDATED', expense('899999999999.9997', 'EUR')),
        ),
    );

    expect(item.parent).toEqual({
        id: 'p1',
        seq: 2,
        domain: 'LEDGER',
        action: 'EXPENSE_CREATED',
        actorUserId: 'u1',
        actorSnapshot: { displayName: 'Ann', picture: null },
        subjectType: 'expense',
        subjectId: 'entry-1',
        groupId: 'g1',
        createdAt: 1_700_000_000,
        parentActivityId: null,
        metadata: {
            type: 'expense',
            entryId: 'entry-1',
            groupId: 'g1',
            groupName: 'Trip',
            description: 'Dinner',
            amount: money(100_000n, 'EUR'),
            payerId: 'u1',
            payerDisplayName: 'Ann',
            shares: [{ userId: 'u2', displayName: 'u2', shareAmount: money(33_333n, 'EUR') }],
        },
    });
    expect(item.parent.metadata).not.toHaveProperty('sharingMode');
    expect(item.parent.metadata).not.toHaveProperty('currency');
    expect(item.lastEvent.metadata?.type === 'expense' && item.lastEvent.metadata.amount).toEqual(
        money(8_999_999_999_999_997n, 'EUR'),
    );
});

test('keeps each item in its own currency (a multi-currency page)', () => {
    const items = toActivityItems([
        preview(wireEvent('p1', 'EXPENSE_CREATED', expense('12.5', 'JPY'))),
        preview(wireEvent('p2', 'SETTLEMENT_CREATED', settlement('-0', 'KWD'))),
        preview(wireEvent('p3', 'SETTLEMENT_CREATED', settlement('0.001', 'USD'))),
    ]);

    expect(items.map(item => ('kind' in item ? item : item.parent.metadata))).toMatchObject([
        { amount: money(125_000n, 'JPY') },
        { type: 'settlement', amount: money(0n, 'KWD') },
        { type: 'settlement', amount: money(10n, 'USD') },
    ]);
});

test('a zero amount is a value; a missing, malformed or foreign-currency amount invalidates only its item', () => {
    const missing = { ...settlement('1', 'USD'), amount: undefined };
    const items = toActivityItems([
        preview(wireEvent('zero', 'EXPENSE_CREATED', expense('0'))),
        // @ts-expect-error a body the contract does not admit: the amount is missing
        preview(wireEvent('missing', 'SETTLEMENT_CREATED', missing)),
        preview(wireEvent('exponent', 'EXPENSE_CREATED', expense('1e3'))),
        preview(wireEvent('currency', 'EXPENSE_CREATED', expense('1', 'EURO'))),
        preview(
            wireEvent('share', 'EXPENSE_CREATED', {
                ...expense('1', 'EUR'),
                shares: [
                    {
                        userId: 'u2',
                        displayName: 'B',
                        shareAmount: createWireAmount('1'),
                        currency: 'USD',
                    },
                ],
            }),
        ),
        preview(wireEvent('ok', 'EXPENSE_CREATED', expense('1'))),
    ]);

    expect(items.map(item => ('kind' in item ? item : item.parent.id))).toEqual([
        'zero',
        { kind: 'invalid', id: 'missing' },
        { kind: 'invalid', id: 'exponent' },
        { kind: 'invalid', id: 'currency' },
        { kind: 'invalid', id: 'share' },
        'ok',
    ]);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(4);
});

test('an unknown or unsupported action, or details of another type, give an unknown event', () => {
    const group = {
        type: 'group',
        groupId: 'g1',
        groupName: 'Trip',
        targetUserDisplayName: 'Cid',
    } satisfies WireMetadata;
    const [unsupported, mismatched, withoutDetails, joined] = [
        wireEvent('p1', 'SETTLEMENT_UPDATED', settlement('1', 'USD')),
        wireEvent('p2', 'EXPENSE_CREATED', settlement('1', 'USD')),
        wireEvent('p3', 'EXPENSE_CREATED', null),
        wireEvent('p5', 'MEMBER_JOINED', group),
    ].map(event => toActivityItem(preview(event)).parent);
    // An action newer than the contract (the shared mapper takes any action text).
    const future = toActivityEventWith(
        { ...wireEvent('p4', 'EXPENSE_CREATED', expense('1')), action: 'EXPENSE_SPLIT_AGAIN' },
        () => {
            throw new Error('an unknown event reads no amount');
        },
    );

    expect(unsupported).toMatchObject({ action: 'SETTLEMENT_UPDATED', metadata: null });
    expect(mismatched).toMatchObject({ action: 'EXPENSE_CREATED', metadata: null });
    expect(withoutDetails).toMatchObject({ action: 'EXPENSE_CREATED', metadata: null });
    expect(future).toMatchObject({ action: 'EXPENSE_SPLIT_AGAIN', metadata: null });
    expect(joined?.metadata).toEqual({
        type: 'group',
        groupId: 'g1',
        groupName: 'Trip',
        targetUserDisplayName: 'Cid',
        targetUsers: undefined,
    });
});

test('expenseBalanceChange: the payer funded amount − own share, a participant owes the share', () => {
    const event = toActivityItem(
        preview(wireEvent('p1', 'EXPENSE_CREATED', expense('10', 'USD', [['u1', '3.3333']]))),
    ).parent;

    if (event.metadata?.type !== 'expense') {
        throw new Error('expected an expense');
    }
    expect(expenseBalanceChange(event.metadata, 'u1')).toEqual(money(66_667n));
    expect(expenseBalanceChange({ ...event.metadata, payerId: 'u9' }, 'u1')).toEqual(
        money(-33_333n),
    );
    expect(expenseBalanceChange({ ...event.metadata, payerId: 'u9' }, 'u5')).toEqual(money(0n));
    expect(expenseBalanceChange({ ...event.metadata, shares: undefined }, 'u1')).toBeUndefined();
});
