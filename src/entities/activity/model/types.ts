import type { InvalidItem, Money } from 'shared/money';

/** Who did it, as it was when the event was recorded. */
export interface ActivityActor {
    readonly displayName: string;
    readonly picture?: string | null;
}

/** One user's share of an expense; `shareAmount` is in the expense currency. */
export interface ExpenseActivityShare {
    readonly userId: string;
    readonly displayName: string;
    readonly shareAmount: Money;
}

/** An expense as it was at the event (`EXPENSE_CREATED/UPDATED/REVERSED`). */
export interface ExpenseActivityDetails {
    readonly type: 'expense';
    readonly entryId: string;
    readonly groupId?: string | null;
    readonly groupName?: string | null;
    readonly description?: string | null;
    readonly amount: Money;
    readonly category?: string | null;
    readonly subcategory?: string | null;
    /** Unix seconds: the business date of the expense. */
    readonly date?: number | null;
    readonly payerId?: string | null;
    readonly payerDisplayName: string;
    /** No snapshot (older events): what the payer funded cannot be told. */
    readonly shares?: readonly ExpenseActivityShare[];
}

export interface ExpenseTransfer {
    readonly debtorId: string;
    readonly creditorId: string;
    readonly amount: Money;
    readonly groupSettlementEntryId: string;
    readonly directExpenseEntryId: string;
}

/** Group debts moved out of a group (`EXPENSE_TRANSFERRED_TO/FROM`). */
export interface ExpenseTransferActivityDetails {
    readonly type: 'expense_transfer';
    readonly groupId: string;
    readonly groupName?: string | null;
    readonly transferredUserId: string;
    readonly actorUserId: string;
    readonly reason: 'LEAVE' | 'KICK' | 'GROUP_DELETED';
    readonly transfers: readonly ExpenseTransfer[];
}

/** A settlement as it was at the event (`SETTLEMENT_CREATED/REVERSED`). */
export interface SettlementActivityDetails {
    readonly type: 'settlement';
    readonly entryId: string;
    readonly groupId?: string | null;
    readonly groupName?: string | null;
    readonly amount: Money;
    readonly actorUserId?: string | null;
    readonly payerId?: string | null;
    readonly fromDisplayName: string;
    readonly toDisplayName: string;
}

export interface ActivityTargetUser {
    readonly userId: string;
    readonly displayName: string;
}

/** A group lifecycle or membership event. */
export interface GroupActivityDetails {
    readonly type: 'group';
    readonly groupId: string;
    readonly groupName: string;
    readonly targetUserDisplayName?: string | null;
    readonly targetUsers?: readonly ActivityTargetUser[];
}

interface ActivityEventBase {
    readonly id: string;
    readonly seq: number;
    readonly domain: 'LEDGER' | 'GROUP';
    readonly actorUserId?: string | null;
    readonly actorSnapshot: ActivityActor;
    readonly subjectType: string;
    readonly subjectId: string;
    readonly groupId?: string | null;
    /** Unix seconds. */
    readonly createdAt: number;
    readonly parentActivityId?: string | null;
}

export type ExpenseActivityAction = 'EXPENSE_CREATED' | 'EXPENSE_UPDATED' | 'EXPENSE_REVERSED';
export type ExpenseTransferActivityAction = 'EXPENSE_TRANSFERRED_TO' | 'EXPENSE_TRANSFERRED_FROM';
export type SettlementActivityAction = 'SETTLEMENT_CREATED' | 'SETTLEMENT_REVERSED';
export type GroupActivityAction =
    | 'GROUP_CREATED'
    | 'GROUP_UPDATED'
    | 'GROUP_DELETED'
    | 'MEMBER_JOINED'
    | 'MEMBER_KICKED'
    | 'MEMBER_LEFT';

export interface ExpenseActivityEvent extends ActivityEventBase {
    readonly action: ExpenseActivityAction;
    readonly metadata: ExpenseActivityDetails;
}

export interface ExpenseTransferActivityEvent extends ActivityEventBase {
    readonly action: ExpenseTransferActivityAction;
    readonly metadata: ExpenseTransferActivityDetails;
}

export interface SettlementActivityEvent extends ActivityEventBase {
    readonly action: SettlementActivityAction;
    readonly metadata: SettlementActivityDetails;
}

export interface GroupActivityEvent extends ActivityEventBase {
    readonly action: GroupActivityAction;
    readonly metadata: GroupActivityDetails;
}

/**
 * An event the app does not show in detail: an action it does not know or support, or one whose
 * details are missing or of another type than the action needs. Shown as an unknown event.
 */
export interface OtherActivityEvent extends ActivityEventBase {
    readonly action: string;
    readonly metadata: null;
}

export type ActivityEvent =
    | ExpenseActivityEvent
    | ExpenseTransferActivityEvent
    | SettlementActivityEvent
    | GroupActivityEvent
    | OtherActivityEvent;

/** A ledger chain: its creation event and its latest event (the current state). */
export interface ActivityPreview {
    readonly parent: ActivityEvent;
    readonly lastEvent: ActivityEvent;
}

/** A preview, or `{ kind: 'invalid', id: parent id }` when one of its amounts cannot be read. */
export type ActivityItem = ActivityPreview | InvalidItem;

/** A flat event, or `{ kind: 'invalid', id: event id }` when one of its amounts cannot be read. */
export type ActivityLogItem = ActivityEvent | InvalidItem;

/**
 * One page of the user's activity previews (`GET /users/self/activity-previews`, the dashboard
 * feed), newest first: active ledger chains, a preview with an unreadable amount an invalid item.
 */
export interface SelfActivityPreviewsPage {
    readonly items: readonly ActivityItem[];
    readonly nextCursor: number | null;
}

/**
 * One page of the user's flat activity log (`GET /users/self/activities`, the Activity page),
 * newest first: every event on its own, an event with an unreadable amount an invalid item.
 */
export interface SelfActivityEventsPage {
    readonly items: readonly ActivityLogItem[];
    readonly nextCursor: number | null;
}
