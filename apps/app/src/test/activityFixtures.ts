// One activity preview (an expense chain) in its shapes: the legacy `src/api` item (number
// amounts), the wire JSON (`api()`; the same JSON) and the domain preview (`Money`). For the same
// arguments, `toActivityItem(wire)` and `legacyActivityPreview(legacy)` both equal the domain one.
import type { AppEvent } from 'api/activity.types';
import type { ActivityFeedItem } from 'api/chipin.types';
import type {
    ActivityEvent,
    ActivityPreview,
    ExpenseActivityDetails,
    ExpenseActivityEvent,
    SettlementActivityEvent,
} from 'entities/activity';
import { legacyActivityEvent } from 'entities/balance';
import { currencyCode, fromUnits } from 'shared/money';

interface PreviewOptions {
    /** The latest event's seq (the parent's is 1; with 1 the parent is its own latest event). */
    readonly seq?: number;
    readonly lastAction?: 'EXPENSE_CREATED' | 'EXPENSE_UPDATED' | 'EXPENSE_REVERSED';
}

// 10 USD paid by user-1: user-1's share 4 USD, user-2's 6 USD.
const AMOUNT = 10;
const SHARES = [
    { userId: 'user-1', displayName: 'Owner', shareAmount: 4 },
    { userId: 'user-2', displayName: 'Member', shareAmount: 6 },
];
const usd = (whole: number) => fromUnits(BigInt(whole) * 10_000n, currencyCode('USD'));

type EventAction = 'EXPENSE_CREATED' | 'EXPENSE_UPDATED' | 'EXPENSE_REVERSED';

const eventFields = (parentId: string, seq: number, action: EventAction) => {
    const id = seq === 1 ? parentId : `${parentId}-${String(seq)}`;

    return {
        id,
        seq,
        domain: 'LEDGER' as const,
        action,
        actorUserId: 'user-1',
        actorSnapshot: { displayName: 'Owner', picture: null },
        subjectType: 'expense' as const,
        subjectId: `entry-${parentId}`,
        groupId: 'group-1',
        createdAt: 1_700_000_000 + seq,
        parentActivityId: id === parentId ? null : parentId,
    };
};

const detailFields = (parentId: string) => ({
    type: 'expense' as const,
    entryId: `entry-${parentId}`,
    groupId: 'group-1',
    groupName: 'Trip',
    description: `Expense ${parentId}`,
    payerId: 'user-1',
    payerDisplayName: 'Owner',
});

const chain = ({ seq = 1, lastAction }: PreviewOptions) =>
    [
        [1, 'EXPENSE_CREATED'],
        [seq, lastAction ?? (seq === 1 ? 'EXPENSE_CREATED' : 'EXPENSE_UPDATED')],
    ] as const;

const legacyEvent = (parentId: string, seq: number, action: EventAction): AppEvent => ({
    ...eventFields(parentId, seq, action),
    metadata: {
        ...detailFields(parentId),
        amount: AMOUNT,
        currency: 'USD',
        shares: SHARES.map(share => ({ ...share, currency: 'USD' })),
    },
});

const domainDetails = (parentId: string): ExpenseActivityDetails => ({
    ...detailFields(parentId),
    amount: usd(AMOUNT),
    shares: SHARES.map(share => ({ ...share, shareAmount: usd(share.shareAmount) })),
});

const domainEvent = (parentId: string, seq: number, action: EventAction): ActivityEvent => ({
    ...eventFields(parentId, seq, action),
    metadata: domainDetails(parentId),
});

/** The legacy item (`src/api`, number amounts). */
export const legacyPreview = (parentId: string, options: PreviewOptions = {}): ActivityFeedItem => {
    const [[parentSeq, parentAction], [seq, action]] = chain(options);

    return {
        parent: legacyEvent(parentId, parentSeq, parentAction),
        lastEvent: legacyEvent(parentId, seq, action),
    };
};

/** The JSON body item of `GET /groups/{groupId}/activity-previews` (the same JSON as legacy). */
export const wirePreview = legacyPreview;

/** The domain preview (amounts as `Money`). */
export const domainPreview = (parentId: string, options: PreviewOptions = {}): ActivityPreview => {
    const [[parentSeq, parentAction], [seq, action]] = chain(options);

    return {
        parent: domainEvent(parentId, parentSeq, parentAction),
        lastEvent: domainEvent(parentId, seq, action),
    };
};

const isExpenseEvent = (event: ActivityEvent): event is ExpenseActivityEvent =>
    event.metadata?.type === 'expense';
const isSettlementEvent = (event: ActivityEvent): event is SettlementActivityEvent =>
    event.metadata?.type === 'settlement';

/** A legacy expense event fixture as the domain event the activity cards render. */
export const domainExpenseEvent = (event: AppEvent): ExpenseActivityEvent => {
    const domain = legacyActivityEvent(event);

    if (!isExpenseEvent(domain)) {
        throw new Error('not an expense event');
    }
    return domain;
};

/** A legacy settlement event fixture as the domain event the activity cards render. */
export const domainSettlementEvent = (event: AppEvent): SettlementActivityEvent => {
    const domain = legacyActivityEvent(event);

    if (!isSettlementEvent(domain)) {
        throw new Error('not a settlement event');
    }
    return domain;
};
