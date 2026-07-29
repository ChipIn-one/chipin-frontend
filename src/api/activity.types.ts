import type {
    ExpenseCreatedAction,
    ExpenseReversedAction,
    ExpenseTransferredFromAction,
    ExpenseTransferredToAction,
    GroupCreatedAction,
    GroupDeletedAction,
    GroupUpdatedAction,
    MemberJoinedAction,
    MemberKickedAction,
    MemberLeftAction,
    SettlementCreatedAction,
    SettlementReversedAction,
} from 'constants/activity';

/** --- LEDGER --- */

type UUID = string;
type Timestamp = number;

type ActorSnapshot = {
    displayName: string;
    picture: string | null;
};

type BaseEvent = {
    id: UUID;
    seq: number;
    domain: 'LEDGER' | 'GROUP' | string;
    action: string;
    actorUserId: UUID;
    actorSnapshot: ActorSnapshot;
    subjectType: string;
    subjectId: UUID;
    groupId: UUID | null;
    metadata: unknown;
    createdAt: Timestamp;
    parentActivityId: UUID | null;
};

type ExpenseMetadata = {
    type: 'expense';
    entryId: UUID;
    groupId: UUID | null;
    groupName: string | null;
    groupEmoji?: string | null;
    description: string | null;
    amount: number;
    currency: string;
    payerId: UUID;
    payerDisplayName: string;
    shares: ExpenseShare[];
    fieldDiffs: FieldDiff[];
};

type ExpenseShare = {
    userId: UUID;
    shareAmount: number;
    currency: string;
};

type ExpenseTransfer = {
    debtorId: UUID;
    creditorId: UUID;
    amount: number;
    currency: string;
    groupSettlementEntryId: UUID;
    directExpenseEntryId: UUID;
};

type ExpenseTransferMetadata = {
    type: 'expense_transfer';
    groupId: UUID;
    groupName: string;
    transferredUserId: UUID;
    actorUserId: UUID;
    reason: string;
    transfers: ExpenseTransfer[];
};

type FieldDiff = {
    field: string;
    oldValue: unknown;
    newValue: unknown;
};

type SettlementMetadata = {
    type: 'settlement';
    entryId: UUID;
    groupId: UUID | null;
    groupName: string | null;
    groupEmoji?: string | null;
    amount: number;
    currency: string;
    actorUserId: UUID;
    payerId: UUID;
    fromDisplayName: string;
    toDisplayName: string;
    fieldDiffs: FieldDiff[];
};

type ExpenseCreatedEvent = BaseEvent & {
    domain: 'LEDGER';
    action: ExpenseCreatedAction;
    subjectType: 'expense';
    metadata: ExpenseMetadata;
};

type ExpenseReversedEvent = BaseEvent & {
    domain: 'LEDGER';
    action: ExpenseReversedAction;
    subjectType: 'expense';
    metadata: ExpenseMetadata;
};

type ExpenseTransferredFromEvent = BaseEvent & {
    domain: 'LEDGER';
    action: ExpenseTransferredFromAction;
    subjectType: 'group_debt_transfer';
    metadata: ExpenseTransferMetadata;
};

type ExpenseTransferredToEvent = BaseEvent & {
    domain: 'LEDGER';
    action: ExpenseTransferredToAction;
    subjectType: 'group_debt_transfer';
    metadata: ExpenseTransferMetadata;
};

type SettlementCreatedEvent = BaseEvent & {
    domain: 'LEDGER';
    action: SettlementCreatedAction;
    subjectType: 'settlement';
    metadata: SettlementMetadata;
};

type SettlementReversedEvent = BaseEvent & {
    domain: 'LEDGER';
    action: SettlementReversedAction;
    subjectType: 'settlement';
    metadata: SettlementMetadata;
};

/** --- GROUP --- */

type GroupMetadata = {
    type: 'group';
    groupId: UUID;
    groupName: string;
    groupEmoji?: string | null;
    groupImage?: string | null;
    targetUserDisplayName: string | null;
};

type GroupCreatedEvent = BaseEvent & {
    domain: 'GROUP';
    action: GroupCreatedAction;
    subjectType: 'group';
    metadata: GroupMetadata;
};

type GroupUpdatedEvent = BaseEvent & {
    domain: 'GROUP';
    action: GroupUpdatedAction;
    subjectType: 'group';
    metadata: GroupMetadata;
};

type GroupDeletedEvent = BaseEvent & {
    domain: 'GROUP';
    action: GroupDeletedAction;
    subjectType: 'group';
    metadata: GroupMetadata;
};

type MemberJoinedEvent = BaseEvent & {
    domain: 'GROUP';
    action: MemberJoinedAction;
    subjectType: 'group';
    metadata: GroupMetadata;
};

type MemberKickedEvent = BaseEvent & {
    domain: 'GROUP';
    action: MemberKickedAction;
    subjectType: 'group';
    metadata: GroupMetadata;
};

type MemberLeftEvent = BaseEvent & {
    domain: 'GROUP';
    action: MemberLeftAction;
    subjectType: 'group';
    metadata: GroupMetadata;
};

/** --- Union --- */

export type AppEvent =
    | ExpenseCreatedEvent
    | ExpenseReversedEvent
    | ExpenseTransferredFromEvent
    | ExpenseTransferredToEvent
    | SettlementCreatedEvent
    | SettlementReversedEvent
    | GroupCreatedEvent
    | GroupUpdatedEvent
    | GroupDeletedEvent
    | MemberJoinedEvent
    | MemberKickedEvent
    | MemberLeftEvent;
