import { parseSelfUserResponse } from './guards';

export interface ContractGroup {
    id: string;
    name: string;
    description: string | null;
    simplifyDebts: boolean;
    memberIds: string[];
    memberBalancesByUserId: Record<
        string,
        Record<string, { currency: string; netBalance: number }>
    >;
}

export interface ContractPage {
    ids: string[];
    nextCursor: number | string | null;
}

export interface ContractActivityPage extends ContractPage {
    ledgerEntryIds: string[];
}

export type ContractPreviewPage = ContractActivityPage;

export interface ContractParticipantShare {
    userId: string;
    shareAmount: number;
    currency: string;
}

export interface ContractDashboard {
    balances: Record<string, { currency: string; netBalance: number }>;
}

export type ContractLedgerEntry =
    | {
          id: string;
          type: 'EXPENSE';
          groupId: string | null;
          amount: number;
          currency: string;
          payerId: string;
          participantIds: string[];
          participantShares: ContractParticipantShare[];
      }
    | {
          id: string;
          type: 'SETTLEMENT';
          groupId: string | null;
          amount: number;
          currency: string;
          fromUserId: string;
          toUserId: string;
      };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
    if (!isRecord(value)) {
        throw new Error(`${label} must be an object`);
    }

    return value;
};

const requireString = (
    record: Record<string, unknown>,
    key: string,
    label: string,
): string => {
    const value = record[key];

    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${label}.${key} must be a non-empty string`);
    }

    return value;
};

const requireNumber = (
    record: Record<string, unknown>,
    key: string,
    label: string,
): number => {
    const value = record[key];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${label}.${key} must be a finite number`);
    }

    return value;
};

const requireBoolean = (
    record: Record<string, unknown>,
    key: string,
    label: string,
): boolean => {
    const value = record[key];

    if (typeof value !== 'boolean') {
        throw new Error(`${label}.${key} must be a boolean`);
    }

    return value;
};

const requireNullableString = (
    record: Record<string, unknown>,
    key: string,
    label: string,
): string | null => {
    const value = record[key];

    if (value === null || typeof value === 'string') {
        return value;
    }

    throw new Error(`${label}.${key} must be a string or null`);
};

const requireArray = (value: unknown, label: string): unknown[] => {
    if (!Array.isArray(value)) {
        throw new Error(`${label} must be an array`);
    }

    return value;
};

const parseCurrencyBalanceMap = (
    value: unknown,
    label: string,
): Record<string, { currency: string; netBalance: number }> => {
    const rawBalances = requireRecord(value, label);
    const balances: Record<string, { currency: string; netBalance: number }> = {};

    for (const [key, rawBalance] of Object.entries(rawBalances)) {
        const balanceLabel = `${label}.${key}`;
        const balance = requireRecord(rawBalance, balanceLabel);
        const currency = requireString(balance, 'currency', balanceLabel);
        const netBalance = requireNumber(balance, 'netBalance', balanceLabel);
        if (currency !== key) {
            throw new Error(`${balanceLabel}.currency must match its map key`);
        }
        balances[key] = { currency, netBalance };
    }

    return balances;
};

const parsePublicUser = (value: unknown, label: string): string => {
    const user = requireRecord(value, label);
    const id = requireString(user, 'id', label);
    requireString(user, 'email', label);
    requireString(user, 'displayName', label);
    requireNumber(user, 'createdAt', label);
    requireNumber(user, 'updatedAt', label);

    return id;
};

const parseActivityActorSnapshot = (value: unknown, label: string): void => {
    const snapshot = requireRecord(value, label);
    requireString(snapshot, 'displayName', label);
    if (snapshot.picture !== undefined) {
        requireNullableString(snapshot, 'picture', label);
    }
};

const parseExpenseActivityMetadata = (value: unknown, label: string): string => {
    const metadata = requireRecord(value, label);
    if (requireString(metadata, 'type', label) !== 'expense') {
        throw new Error(`${label}.type must be expense`);
    }
    const entryId = requireString(metadata, 'entryId', label);
    requireNumber(metadata, 'amount', label);
    requireString(metadata, 'currency', label);
    requireString(metadata, 'payerDisplayName', label);

    if (metadata.payerId !== undefined) {
        requireNullableString(metadata, 'payerId', label);
    }

    const shares = requireArray(metadata.shares, `${label}.shares`);
    for (let index = 0; index < shares.length; index += 1) {
        const share = requireRecord(shares[index], `${label}.shares[${index}]`);
        requireString(share, 'userId', `${label}.shares[${index}]`);
        requireString(share, 'displayName', `${label}.shares[${index}]`);
        requireNumber(share, 'shareAmount', `${label}.shares[${index}]`);
        requireString(share, 'currency', `${label}.shares[${index}]`);
    }

    return entryId;
};

const parseGroupActivityMetadata = (value: unknown, label: string): void => {
    const metadata = requireRecord(value, label);
    if (requireString(metadata, 'type', label) !== 'group') {
        throw new Error(`${label}.type must be group`);
    }
    requireString(metadata, 'groupId', label);
    requireString(metadata, 'groupName', label);

    if (metadata.targetUserDisplayName !== undefined) {
        requireNullableString(metadata, 'targetUserDisplayName', label);
    }
    if (metadata.targetUsers !== undefined) {
        const targetUsers = requireArray(metadata.targetUsers, `${label}.targetUsers`);
        for (let index = 0; index < targetUsers.length; index += 1) {
            const target = requireRecord(targetUsers[index], `${label}.targetUsers[${index}]`);
            requireString(target, 'userId', `${label}.targetUsers[${index}]`);
            requireString(target, 'displayName', `${label}.targetUsers[${index}]`);
        }
    }
};

const parseSettlementActivityMetadata = (value: unknown, label: string): string => {
    const metadata = requireRecord(value, label);
    if (requireString(metadata, 'type', label) !== 'settlement') {
        throw new Error(`${label}.type must be settlement`);
    }
    const entryId = requireString(metadata, 'entryId', label);
    requireNumber(metadata, 'amount', label);
    requireString(metadata, 'currency', label);
    requireString(metadata, 'fromDisplayName', label);
    requireString(metadata, 'toDisplayName', label);

    if (metadata.actorUserId !== undefined) {
        requireNullableString(metadata, 'actorUserId', label);
    }
    if (metadata.payerId !== undefined) {
        requireNullableString(metadata, 'payerId', label);
    }

    return entryId;
};

const parseActivityEvent = (
    value: unknown,
    label: string,
): { id: string; ledgerEntryId: string | null } => {
    const event = requireRecord(value, label);
    const id = requireString(event, 'id', label);
    requireNumber(event, 'seq', label);
    requireString(event, 'domain', label);
    const action = requireString(event, 'action', label);
    requireString(event, 'subjectType', label);
    requireString(event, 'subjectId', label);
    parseActivityActorSnapshot(event.actorSnapshot, `${label}.actorSnapshot`);
    requireNumber(event, 'createdAt', label);

    let ledgerEntryId: string | null = null;
    if (action === 'EXPENSE_CREATED' || action === 'EXPENSE_UPDATED' || action === 'EXPENSE_REVERSED') {
        ledgerEntryId = parseExpenseActivityMetadata(event.metadata, `${label}.metadata`);
    }
    if (
        action === 'SETTLEMENT_CREATED' ||
        action === 'SETTLEMENT_UPDATED' ||
        action === 'SETTLEMENT_REVERSED'
    ) {
        ledgerEntryId = parseSettlementActivityMetadata(event.metadata, `${label}.metadata`);
    }
    if (
        action === 'GROUP_CREATED' ||
        action === 'GROUP_UPDATED' ||
        action === 'GROUP_DELETED' ||
        action === 'GROUP_DEACTIVATED' ||
        action === 'OWNERSHIP_TRANSFERRED' ||
        action === 'MEMBER_JOINED' ||
        action === 'MEMBER_LEFT' ||
        action === 'MEMBER_KICKED' ||
        action === 'MEMBERS_ADDED'
    ) {
        parseGroupActivityMetadata(event.metadata, `${label}.metadata`);
    }

    return { id, ledgerEntryId };
};

export const parseSelfUserContract = (value: unknown): ReturnType<typeof parseSelfUserResponse> => {
    const parsed = parseSelfUserResponse(value);
    const response = requireRecord(value, 'self');
    requireBoolean(response, 'isPremium', 'self');

    return parsed;
};

export const parseInviteLink = (value: unknown): string =>
    requireString(requireRecord(value, 'inviteLink'), 'inviteToken', 'inviteLink');

export const parseKnownUsers = (value: unknown): string[] => {
    const response = requireRecord(value, 'knownUsers');
    const friends = requireArray(response.friends, 'knownUsers.friends');
    const ids: string[] = [];

    for (let index = 0; index < friends.length; index += 1) {
        const friend = requireRecord(friends[index], `knownUsers.friends[${index}]`);
        ids.push(parsePublicUser(friend.user, `knownUsers.friends[${index}].user`));
        const balances = requireArray(friend.balances, `knownUsers.friends[${index}].balances`);
        for (let balanceIndex = 0; balanceIndex < balances.length; balanceIndex += 1) {
            const label = `knownUsers.friends[${index}].balances[${balanceIndex}]`;
            const balance = requireRecord(balances[balanceIndex], label);
            requireString(balance, 'currency', label);
            requireNumber(balance, 'netAmount', label);
        }
        requireNullableString(friend, 'lastUsedCurrency', `knownUsers.friends[${index}]`);
    }

    return ids;
};

export const parseGroup = (value: unknown): ContractGroup => {
    const group = requireRecord(value, 'group');
    const id = requireString(group, 'id', 'group');
    const name = requireString(group, 'name', 'group');
    requireString(group, 'inviteToken', 'group');
    const description = requireNullableString(group, 'description', 'group');
    parsePublicUser(group.creator, 'group.creator');
    requireNumber(group, 'createdAt', 'group');
    requireNumber(group, 'updatedAt', 'group');
    requireNullableString(group, 'coverUrl', 'group');
    const simplifyDebts = requireBoolean(group, 'simplifyDebts', 'group');
    requireString(group, 'role', 'group');
    requireString(group, 'status', 'group');
    requireNullableString(group, 'lastUsedCurrency', 'group');
    parsePreviewPage(group.recentActivities, 'group.recentActivities');

    const members = requireArray(group.members, 'group.members');
    const memberIds: string[] = [];
    const memberBalancesByUserId: ContractGroup['memberBalancesByUserId'] = {};
    for (let index = 0; index < members.length; index += 1) {
        const member = requireRecord(members[index], `group.members[${index}]`);
        const memberId = parsePublicUser(member.user, `group.members[${index}].user`);
        memberIds.push(memberId);
        memberBalancesByUserId[memberId] = parseCurrencyBalanceMap(
            member.balancesByCurrency,
            `group.members[${index}].balancesByCurrency`,
        );
    }

    return {
        id,
        name,
        description,
        simplifyDebts,
        memberIds,
        memberBalancesByUserId,
    };
};

export const parseGroupPage = (value: unknown): ContractPage => {
    const response = requireRecord(value, 'groups');
    const items = requireArray(response.items, 'groups.items');
    const ids: string[] = [];
    for (let index = 0; index < items.length; index += 1) {
        ids.push(parseGroup(items[index]).id);
    }

    const cursor = response.nextCursor;
    if (cursor !== null && (typeof cursor !== 'string' || cursor.length === 0)) {
        throw new Error('groups.nextCursor must be a non-empty string or null');
    }

    return { ids, nextCursor: cursor };
};

export const parseLedgerEntry = (value: unknown): ContractLedgerEntry => {
    const entry = requireRecord(value, 'ledger');
    const id = requireString(entry, 'id', 'ledger');
    const type = requireString(entry, 'type', 'ledger');
    const scope = requireString(entry, 'scope', 'ledger');
    const groupId = requireNullableString(entry, 'groupId', 'ledger');
    requireNumber(entry, 'createdAt', 'ledger');
    requireNumber(entry, 'updatedAt', 'ledger');

    if (scope !== 'GROUP' && scope !== 'USER') {
        throw new Error('ledger.scope must be GROUP or USER');
    }

    if (type === 'EXPENSE') {
        const expense = requireRecord(entry.expense, 'ledger.expense');
        const amount = requireNumber(expense, 'amount', 'ledger.expense');
        const currency = requireString(expense, 'currency', 'ledger.expense');
        requireNumber(expense, 'date', 'ledger.expense');
        const payerId = parsePublicUser(expense.payer, 'ledger.expense.payer');
        const participants = requireArray(expense.participants, 'ledger.expense.participants');
        const participantIds = participants.map((participant, index) =>
            parsePublicUser(participant, `ledger.expense.participants[${index}]`),
        );
        const rawParticipantShares = requireArray(
            expense.participantShares,
            'ledger.expense.participantShares',
        );
        const participantShares = rawParticipantShares.map((share, index) => {
            const label = `ledger.expense.participantShares[${index}]`;
            const record = requireRecord(share, label);
            return {
                userId: requireString(record, 'userId', label),
                shareAmount: requireNumber(record, 'shareAmount', label),
                currency: requireString(record, 'currency', label),
            };
        });
        parsePublicUser(expense.creator, 'ledger.expense.creator');
        if (entry.settlement !== null) {
            throw new Error('ledger.settlement must be null for EXPENSE');
        }
        return {
            id,
            type,
            groupId,
            amount,
            currency,
            payerId,
            participantIds,
            participantShares,
        };
    }

    if (type === 'SETTLEMENT') {
        const settlement = requireRecord(entry.settlement, 'ledger.settlement');
        const fromUserId = parsePublicUser(settlement.fromUser, 'ledger.settlement.fromUser');
        const toUserId = parsePublicUser(settlement.toUser, 'ledger.settlement.toUser');
        const amount = requireNumber(settlement, 'amount', 'ledger.settlement');
        const currency = requireString(settlement, 'currency', 'ledger.settlement');
        requireNumber(settlement, 'settledAt', 'ledger.settlement');
        if (entry.expense !== null) {
            throw new Error('ledger.expense must be null for SETTLEMENT');
        }
        return { id, type, groupId, amount, currency, fromUserId, toUserId };
    }

    throw new Error('ledger.type must be EXPENSE or SETTLEMENT');
};

const parsePreviewPage = (value: unknown, label: string): ContractPreviewPage => {
    const response = requireRecord(value, label);
    const items = requireArray(response.items, `${label}.items`);
    const ids: string[] = [];
    const ledgerEntryIds: string[] = [];
    for (let index = 0; index < items.length; index += 1) {
        const item = requireRecord(items[index], `${label}.items[${index}]`);
        const parent = parseActivityEvent(item.parent, `${label}.items[${index}].parent`);
        ids.push(parent.id);
        if (parent.ledgerEntryId !== null) {
            ledgerEntryIds.push(parent.ledgerEntryId);
        }
        parseActivityEvent(item.lastEvent, `${label}.items[${index}].lastEvent`);
    }
    const cursor = response.nextCursor;
    if (cursor !== null && (typeof cursor !== 'number' || !Number.isSafeInteger(cursor))) {
        throw new Error(`${label}.nextCursor must be a safe integer or null`);
    }
    return { ids, nextCursor: cursor, ledgerEntryIds };
};

export const parseActivityPage = (value: unknown): ContractActivityPage => {
    const response = requireRecord(value, 'activity');
    const items = requireArray(response.items, 'activity.items');
    const ids: string[] = [];
    const ledgerEntryIds: string[] = [];
    for (let index = 0; index < items.length; index += 1) {
        const event = parseActivityEvent(items[index], `activity.items[${index}]`);
        ids.push(event.id);
        if (event.ledgerEntryId !== null) {
            ledgerEntryIds.push(event.ledgerEntryId);
        }
    }
    const cursor = response.nextCursor;
    if (cursor !== null && (typeof cursor !== 'number' || !Number.isSafeInteger(cursor))) {
        throw new Error('activity.nextCursor must be a safe integer or null');
    }
    return { ids, nextCursor: cursor, ledgerEntryIds };
};

export const parseActivityPreviewPage = (value: unknown): ContractPreviewPage =>
    parsePreviewPage(value, 'activityPreviews');

export const parseDashboard = (value: unknown): ContractDashboard => {
    const dashboard = requireRecord(value, 'dashboard');
    const balances = parseCurrencyBalanceMap(dashboard.balances, 'dashboard.balances');
    parsePreviewPage(dashboard.activity, 'dashboard.activity');
    const groups = requireArray(dashboard.groups, 'dashboard.groups');
    if (groups.length !== 0) {
        throw new Error('dashboard.groups compatibility field must stay empty');
    }

    return { balances };
};

export const parseCurrencyRates = (value: unknown): { base: string } => {
    const rates = requireRecord(value, 'currencyRates');
    const base = requireString(rates, 'base', 'currencyRates');
    requireNumber(rates, 'timestamp', 'currencyRates');
    requireNumber(rates, 'fetchedAt', 'currencyRates');
    requireBoolean(rates, 'stale', 'currencyRates');
    const values = requireRecord(rates.rates, 'currencyRates.rates');
    if (
        typeof values.EUR !== 'number' ||
        !Number.isFinite(values.EUR) ||
        values.EUR <= 0
    ) {
        throw new Error('currencyRates.rates.EUR must be a positive finite number');
    }

    return { base };
};

export const parseErrorCode = (value: unknown): { code: string; details?: Record<string, unknown> } => {
    const error = requireRecord(value, 'error');
    const code = requireString(error, 'code', 'error');
    const details = error.details;
    if (details === undefined) {
        return { code };
    }
    return { code, details: requireRecord(details, 'error.details') };
};
