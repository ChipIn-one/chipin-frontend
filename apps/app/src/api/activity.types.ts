import type {
    ActivityAction,
    ExpenseCreatedAction,
    ExpenseReversedAction,
    ExpenseTransferredFromAction,
    ExpenseTransferredToAction,
    ExpenseUpdatedAction,
    GroupCreatedAction,
    GroupDeactivatedAction,
    GroupDeletedAction,
    GroupUpdatedAction,
    MemberJoinedAction,
    MemberKickedAction,
    MemberLeftAction,
    MembersAddedAction,
    OwnershipTransferredAction,
    SettlementCreatedAction,
    SettlementReversedAction,
    SettlementUpdatedAction,
} from 'constants/activity';

import type { SharingMode } from './chipin.params';

/** --- LEDGER --- */

type UUID = string;
type Timestamp = number;

type ActorSnapshot = {
    displayName: string;
    picture?: string | null;
};

type BaseEvent = {
    id: UUID;
    seq: number;
    domain: 'LEDGER' | 'GROUP';
    action: string;
    actorUserId?: UUID | null;
    actorSnapshot: ActorSnapshot;
    subjectType: string;
    subjectId: UUID;
    groupId?: UUID | null;
    metadata?: unknown | null;
    createdAt: Timestamp;
    parentActivityId?: UUID | null;
};

export type ExpenseActivityMetadata = {
    type: 'expense';
    entryId: UUID;
    groupId?: UUID | null;
    groupName?: string | null;
    description?: string | null;
    amount: number;
    currency: string;
    category?: string | null;
    subcategory?: string | null;
    date?: number | null;
    sharingMode?: SharingMode | null;
    payerId?: UUID | null;
    payerDisplayName: string;
    shares?: ExpenseActivityShare[];
    fieldDiffs?: unknown;
};

export type ExpenseActivityShare = {
    userId: UUID;
    displayName: string;
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
    groupName?: string | null;
    transferredUserId: UUID;
    actorUserId: UUID;
    reason: 'LEAVE' | 'KICK' | 'GROUP_DELETED';
    transfers: ExpenseTransfer[];
};

type SettlementMetadata = {
    type: 'settlement';
    entryId: UUID;
    groupId?: UUID | null;
    groupName?: string | null;
    amount: number;
    currency: string;
    actorUserId?: UUID | null;
    payerId?: UUID | null;
    fromDisplayName: string;
    toDisplayName: string;
};

type ExpenseCreatedEvent = BaseEvent & {
    domain: 'LEDGER';
    action: ExpenseCreatedAction;
    subjectType: 'expense';
    metadata: ExpenseActivityMetadata;
};

type ExpenseUpdatedEvent = BaseEvent & {
    domain: 'LEDGER';
    action: ExpenseUpdatedAction;
    subjectType: 'expense';
    metadata: ExpenseActivityMetadata;
};

type ExpenseReversedEvent = BaseEvent & {
    domain: 'LEDGER';
    action: ExpenseReversedAction;
    subjectType: 'expense';
    metadata: ExpenseActivityMetadata;
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
    targetUserDisplayName?: string | null;
    targetUsers?: Array<{ userId: UUID; displayName: string }>;
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

type UnsupportedActivityEvent = BaseEvent & {
    action:
        | GroupDeactivatedAction
        | OwnershipTransferredAction
        | MembersAddedAction
        | SettlementUpdatedAction;
    metadata?: ExpenseActivityMetadata | SettlementMetadata | GroupMetadata | null;
};

type MetadataUnavailableEvent = Omit<BaseEvent, 'action' | 'metadata'> & {
    action: ActivityAction;
    metadata?: null;
};

/** --- Union --- */

export type AppEvent =
    | ExpenseCreatedEvent
    | ExpenseUpdatedEvent
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
    | MemberLeftEvent
    | UnsupportedActivityEvent
    | MetadataUnavailableEvent;
