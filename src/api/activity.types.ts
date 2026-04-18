/** --- LEDGER --- */

type UUID = string;
type Timestamp = number;

type ActorSnapshot = {
    displayName: string;
    picture: string;
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
    amount: string;
    currency: string;
    payerDisplayName: string;
};

type ExpenseCreatedEvent = BaseEvent & {
    domain: 'LEDGER';
    action: 'EXPENSE_CREATED';
    subjectType: 'expense';
    metadata: ExpenseMetadata;
};

/** --- GROUP --- */

type GroupMetadata = {
    type: 'group';
    groupId: UUID;
    groupName: string;
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

/** --- Union --- */

export type AppEvent =
    | ExpenseCreatedEvent
    | GroupCreatedEvent
    | GroupUpdatedEvent
    | GroupDeletedEvent;
