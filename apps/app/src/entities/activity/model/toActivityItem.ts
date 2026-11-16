// Activity events and previews (wire) → domain (spec 03 §1.3, §4.1). Every amount becomes `Money`
// through `moneyFromWire`; a preview with an unreadable amount or currency becomes an invalid item.
import type { components } from 'shared/api/generated/schema';
import type { CurrencyCode, Money, WireAmount } from 'shared/money';
import { currencyCode, mapItems, moneyFromWire, MoneyWireError } from 'shared/money';

import type {
    ActivityChildrenPage,
    ActivityEvent,
    ActivityItem,
    ActivityLogItem,
    ActivityPreview,
    ExpenseActivityDetails,
    ExpenseSharingMode,
    ExpenseTransferActivityDetails,
    GroupActivityDetails,
    SettlementActivityDetails,
} from './types';

type LedgerActivityPreview = components['schemas']['LedgerActivityPreview'];
type ActivityEventResponse = components['schemas']['ActivityEventResponse'];
type ActivityChildrenFeedResponse = components['schemas']['ActivityChildrenFeedResponse'];

/** Reads one amount of the source shape as `Money`; throws `MoneyWireError` when it cannot. */
export type MoneyReader<A> = (amount: A, currency: string) => Money;

interface SourceShare<A> {
    readonly userId: string;
    readonly displayName: string;
    readonly shareAmount: A;
    readonly currency: string;
}

// Percents and weights come as decimal text (wire) or as numbers (legacy); neither is money.
interface SourceSharingMode<A> {
    readonly type: string;
    readonly customShares?: Readonly<Record<string, A>>;
    readonly percentageShares?: Readonly<Record<string, string | number>>;
    readonly shares?: Readonly<Record<string, string | number>>;
}

interface SourceExpense<A> extends Omit<
    ExpenseActivityDetails,
    'amount' | 'shares' | 'sharingMode'
> {
    readonly amount: A;
    readonly currency: string;
    readonly shares?: readonly SourceShare<A>[];
    readonly sharingMode?: SourceSharingMode<A> | null;
}

interface SourceTransfer<A> {
    readonly debtorId: string;
    readonly creditorId: string;
    readonly amount: A;
    readonly currency: string;
    readonly groupSettlementEntryId: string;
    readonly directExpenseEntryId: string;
}

interface SourceExpenseTransfer<A> extends Omit<ExpenseTransferActivityDetails, 'transfers'> {
    readonly transfers: readonly SourceTransfer<A>[];
}

interface SourceSettlement<A> extends Omit<SettlementActivityDetails, 'amount'> {
    readonly amount: A;
    readonly currency: string;
}

/** Details of a kind the app does not show yet (recurring expenses): the event maps to unknown. */
interface SourceUnshownDetails {
    readonly type: 'recurring_expense';
}

type SourceMetadata<A> =
    | SourceExpense<A>
    | SourceExpenseTransfer<A>
    | SourceSettlement<A>
    | GroupActivityDetails
    | SourceUnshownDetails;

/**
 * An activity event as the wire or the legacy layer gives it: the same fields, amounts of type
 * `A` (`WireAmount` or a legacy number) with their currency beside them.
 */
export interface SourceActivityEvent<A> extends Omit<ActivityEvent, 'action' | 'metadata'> {
    readonly action: string;
    readonly metadata?: SourceMetadata<A> | null;
}

const EXPENSE_ACTIONS = ['EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_REVERSED'] as const;
const TRANSFER_ACTIONS = ['EXPENSE_TRANSFERRED_TO', 'EXPENSE_TRANSFERRED_FROM'] as const;
const SETTLEMENT_ACTIONS = ['SETTLEMENT_CREATED', 'SETTLEMENT_REVERSED'] as const;
const GROUP_ACTIONS = [
    'GROUP_CREATED',
    'GROUP_UPDATED',
    'GROUP_DELETED',
    'MEMBER_JOINED',
    'MEMBER_KICKED',
    'MEMBER_LEFT',
] as const;

const isOneOf = <T extends string>(actions: readonly T[], action: string): action is T =>
    actions.some(known => known === action);

const mapValues = <V, X>(
    values: Readonly<Record<string, V>> | undefined,
    toX: (value: V) => X,
): Record<string, X> =>
    Object.fromEntries(Object.entries(values ?? {}).map(([key, value]) => [key, toX(value)]));

// An unknown mode is no snapshot (`null`): the expense is shown and edited as split exactly.
const toSharingMode = <A>(
    source: SourceSharingMode<A>,
    currency: string,
    read: MoneyReader<A>,
): ExpenseSharingMode | null => {
    switch (source.type) {
        case 'AUTO':
            return { type: 'AUTO' };
        case 'EXACT':
            return {
                type: 'EXACT',
                customShares: mapValues(source.customShares, value => read(value, currency)),
            };
        case 'PERCENTAGE':
            return {
                type: 'PERCENTAGE',
                percentageShares: mapValues(source.percentageShares, String),
            };
        case 'SHARES':
            return { type: 'SHARES', shares: mapValues(source.shares, String) };
        default:
            return null;
    }
};

const toExpense = <A>(source: SourceExpense<A>, read: MoneyReader<A>): ExpenseActivityDetails => {
    const amount = read(source.amount, source.currency);
    const sharingMode =
        source.sharingMode && toSharingMode(source.sharingMode, source.currency, read);

    return {
        type: 'expense',
        entryId: source.entryId,
        groupId: source.groupId,
        groupName: source.groupName,
        description: source.description,
        amount,
        category: source.category,
        subcategory: source.subcategory,
        date: source.date,
        payerId: source.payerId,
        payerDisplayName: source.payerDisplayName,
        shares: source.shares?.map(share => {
            const shareAmount = read(share.shareAmount, share.currency);

            // A share is part of its expense: another currency is a broken snapshot, not a value.
            if (shareAmount.currency !== amount.currency) {
                throw new MoneyWireError('shape');
            }
            return { userId: share.userId, displayName: share.displayName, shareAmount };
        }),
        // Only with a snapshot of a known mode: older events have none.
        ...(sharingMode && { sharingMode }),
    };
};

const toTransferDetails = <A>(
    source: SourceExpenseTransfer<A>,
    read: MoneyReader<A>,
): ExpenseTransferActivityDetails => ({
    type: 'expense_transfer',
    groupId: source.groupId,
    groupName: source.groupName,
    transferredUserId: source.transferredUserId,
    actorUserId: source.actorUserId,
    reason: source.reason,
    transfers: source.transfers.map(transfer => ({
        debtorId: transfer.debtorId,
        creditorId: transfer.creditorId,
        amount: read(transfer.amount, transfer.currency),
        groupSettlementEntryId: transfer.groupSettlementEntryId,
        directExpenseEntryId: transfer.directExpenseEntryId,
    })),
});

const toSettlement = <A>(
    source: SourceSettlement<A>,
    read: MoneyReader<A>,
): SettlementActivityDetails => ({
    type: 'settlement',
    entryId: source.entryId,
    groupId: source.groupId,
    groupName: source.groupName,
    amount: read(source.amount, source.currency),
    actorUserId: source.actorUserId,
    payerId: source.payerId,
    fromDisplayName: source.fromDisplayName,
    toDisplayName: source.toDisplayName,
});

// Only the fields of the domain: the wire adds others (diffs, image) the app does not read.
const toGroupDetails = (source: GroupActivityDetails): GroupActivityDetails => ({
    type: 'group',
    groupId: source.groupId,
    groupName: source.groupName,
    targetUserDisplayName: source.targetUserDisplayName,
    targetUsers: source.targetUsers?.map(({ userId, displayName }) => ({ userId, displayName })),
});

/**
 * One event with its amounts read by `read` (the shared shape of the wire and the legacy mapper).
 * An action the app does not show in detail, or details missing or of another type than the
 * action needs, give `metadata: null` (an unknown event).
 */
export const toActivityEventWith = <A>(
    source: SourceActivityEvent<A>,
    read: MoneyReader<A>,
): ActivityEvent => {
    const { metadata, action } = source;
    const base = {
        id: source.id,
        seq: source.seq,
        domain: source.domain,
        actorUserId: source.actorUserId,
        actorSnapshot: {
            displayName: source.actorSnapshot.displayName,
            picture: source.actorSnapshot.picture,
        },
        subjectType: source.subjectType,
        subjectId: source.subjectId,
        groupId: source.groupId,
        createdAt: source.createdAt,
        parentActivityId: source.parentActivityId,
    };

    if (metadata?.type === 'expense' && isOneOf(EXPENSE_ACTIONS, action)) {
        return { ...base, action, metadata: toExpense(metadata, read) };
    }
    if (metadata?.type === 'expense_transfer' && isOneOf(TRANSFER_ACTIONS, action)) {
        return { ...base, action, metadata: toTransferDetails(metadata, read) };
    }
    if (metadata?.type === 'settlement' && isOneOf(SETTLEMENT_ACTIONS, action)) {
        return { ...base, action, metadata: toSettlement(metadata, read) };
    }
    if (metadata?.type === 'group' && isOneOf(GROUP_ACTIONS, action)) {
        return { ...base, action, metadata: toGroupDetails(metadata) };
    }
    return { ...base, action, metadata: null };
};

const toCurrency = (code: string): CurrencyCode => {
    try {
        return currencyCode(code);
    } catch {
        // Rejected like a malformed amount: the item is invalid and reported, the rest shows.
        throw new MoneyWireError('shape');
    }
};

const readWire: MoneyReader<WireAmount> = (amount, currency) =>
    moneyFromWire(amount, toCurrency(currency));

/** One preview (wire) → domain; throws `MoneyWireError` when one of its amounts is unreadable. */
export const toActivityItem = (preview: LedgerActivityPreview): ActivityPreview => ({
    parent: toActivityEventWith<WireAmount>(preview.parent, readWire),
    lastEvent: toActivityEventWith<WireAmount>(preview.lastEvent, readWire),
});

/** Previews (wire) → domain, in order; a preview with an unreadable amount is an invalid item. */
export const toActivityItems = (previews: readonly LedgerActivityPreview[]): ActivityItem[] =>
    mapItems(previews, toActivityItem, preview => preview.parent.id);

/** Flat events (wire) → domain, in order; an event with an unreadable amount is an invalid item. */
export const toActivityLogItems = (events: readonly ActivityEventResponse[]): ActivityLogItem[] =>
    mapItems(
        events,
        event => toActivityEventWith<WireAmount>(event, readWire),
        event => event.id,
    );

/**
 * A page of an activity chain's history (wire) → domain: its creation event and later events,
 * each an invalid item when one of its amounts is unreadable.
 */
export const toActivityChildrenPage = ({
    parent,
    items,
    nextCursor,
}: ActivityChildrenFeedResponse): ActivityChildrenPage => {
    const [parentItem = { kind: 'invalid', id: parent.id }] = toActivityLogItems([parent]);

    return { parent: parentItem, items: toActivityLogItems(items), nextCursor };
};
