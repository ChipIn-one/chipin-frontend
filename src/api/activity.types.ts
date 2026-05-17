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
};

type ExpenseMetadata = {
    type: 'expense';
    entryId: UUID;
    groupId: UUID;
    groupName: string;
    description: string;
    amount: number;
    currency: string;
    payerDisplayName: string;
};

type SettlementMetadata = {
    type: 'settlement';
    entryId: UUID;
    groupId: UUID;
    groupName: string;
    amount: number;
    currency: string;
    fromDisplayName: string;
    toDisplayName: string;
};

type ExpenseCreatedEvent = BaseEvent & {
    domain: 'LEDGER';
    action: 'EXPENSE_CREATED';
    subjectType: 'expense';
    metadata: ExpenseMetadata;
};

type SettlementCreatedEvent = BaseEvent & {
    domain: 'LEDGER';
    action: 'SETTLEMENT_CREATED';
    subjectType: 'ledger_entry';
    metadata: SettlementMetadata;
};

/** --- GROUP --- */

type GroupMetadata = {
    type: 'group';
    groupId: UUID;
    groupName: string;
    groupEmoji?: string | null;
    targetUserDisplayName: string | null;
};

type GroupCreatedEvent = BaseEvent & {
    domain: 'GROUP';
    action: 'GROUP_CREATED';
    subjectType: 'group';
    metadata: GroupMetadata;
};

type GroupUpdatedEvent = BaseEvent & {
    domain: 'GROUP';
    action: 'GROUP_UPDATED';
    subjectType: 'group';
    metadata: GroupMetadata;
};

type GroupDeletedEvent = BaseEvent & {
    domain: 'GROUP';
    action: 'GROUP_DELETED';
    subjectType: 'group';
    metadata: GroupMetadata;
};

type MemberJoinedEvent = BaseEvent & {
    domain: 'GROUP';
    action: 'MEMBER_JOINED';
    subjectType: 'group';
    metadata: GroupMetadata;
};

type MemberLeftEvent = BaseEvent & {
    domain: 'GROUP';
    action: 'MEMBER_LEFT';
    subjectType: 'group';
    metadata: GroupMetadata;
};

/** --- Union --- */

export type AppEvent =
    | ExpenseCreatedEvent
    | SettlementCreatedEvent
    | GroupCreatedEvent
    | GroupUpdatedEvent
    | GroupDeletedEvent
    | MemberJoinedEvent
    | MemberLeftEvent;
