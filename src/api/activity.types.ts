import type {
    ExpenseCreatedAction,
    ExpenseReversedAction,
    GroupCreatedAction,
    GroupDeletedAction,
    GroupUpdatedAction,
    MemberJoinedAction,
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
    groupId: UUID;
    metadata: unknown;
    createdAt: Timestamp;
    parentActivityId: UUID | null;
};

type ExpenseMetadata = {
    type: 'expense';
    entryId: UUID;
    groupId: UUID;
    groupName: string;
    description: string;
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

type FieldDiff = {
    field: string;
    oldValue: unknown;
    newValue: unknown;
};

type SettlementMetadata = {
    type: 'settlement';
    entryId: UUID;
    groupId: UUID;
    groupName: string;
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
    | SettlementCreatedEvent
    | SettlementReversedEvent
    | GroupCreatedEvent
    | GroupUpdatedEvent
    | GroupDeletedEvent
    | MemberJoinedEvent
    | MemberLeftEvent;
