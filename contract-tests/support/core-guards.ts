import { parseSelfUserResponse } from './guards';

export interface ContractGroup {
    id: string;
    memberIds: string[];
}

export interface ContractPage {
    ids: string[];
    nextCursor: number | string | null;
}

export interface ContractLedgerEntry {
    id: string;
    type: 'EXPENSE' | 'SETTLEMENT';
    groupId: string | null;
}

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

const parsePublicUser = (value: unknown, label: string): string => {
    const user = requireRecord(value, label);
    const id = requireString(user, 'id', label);
    requireString(user, 'email', label);
    requireString(user, 'displayName', label);
    requireNumber(user, 'createdAt', label);
    requireNumber(user, 'updatedAt', label);

    return id;
};

const parseActivityEvent = (value: unknown, label: string): string => {
    const event = requireRecord(value, label);
    const id = requireString(event, 'id', label);
    requireNumber(event, 'seq', label);
    requireString(event, 'domain', label);
    requireString(event, 'action', label);
    requireString(event, 'subjectType', label);
    requireString(event, 'subjectId', label);
    requireNumber(event, 'createdAt', label);

    return id;
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
        requireArray(friend.balances, `knownUsers.friends[${index}].balances`);
        requireNullableString(friend, 'lastUsedCurrency', `knownUsers.friends[${index}]`);
    }

    return ids;
};

export const parseGroup = (value: unknown): ContractGroup => {
    const group = requireRecord(value, 'group');
    const id = requireString(group, 'id', 'group');
    requireString(group, 'name', 'group');
    requireString(group, 'inviteToken', 'group');
    requireNullableString(group, 'description', 'group');
    parsePublicUser(group.creator, 'group.creator');
    requireNumber(group, 'createdAt', 'group');
    requireNumber(group, 'updatedAt', 'group');
    requireNullableString(group, 'coverUrl', 'group');
    requireBoolean(group, 'simplifyDebts', 'group');
    requireString(group, 'role', 'group');
    requireString(group, 'status', 'group');
    requireNullableString(group, 'lastUsedCurrency', 'group');
    parsePreviewPage(group.recentActivities, 'group.recentActivities');

    const members = requireArray(group.members, 'group.members');
    const memberIds: string[] = [];
    for (let index = 0; index < members.length; index += 1) {
        const member = requireRecord(members[index], `group.members[${index}]`);
        memberIds.push(parsePublicUser(member.user, `group.members[${index}].user`));
        requireRecord(member.balancesByCurrency, `group.members[${index}].balancesByCurrency`);
    }

    return { id, memberIds };
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
        requireNumber(expense, 'amount', 'ledger.expense');
        requireString(expense, 'currency', 'ledger.expense');
        requireNumber(expense, 'date', 'ledger.expense');
        parsePublicUser(expense.payer, 'ledger.expense.payer');
        requireArray(expense.participants, 'ledger.expense.participants');
        requireArray(expense.participantShares, 'ledger.expense.participantShares');
        parsePublicUser(expense.creator, 'ledger.expense.creator');
        if (entry.settlement !== null) {
            throw new Error('ledger.settlement must be null for EXPENSE');
        }
        return { id, type, groupId };
    }

    if (type === 'SETTLEMENT') {
        const settlement = requireRecord(entry.settlement, 'ledger.settlement');
        parsePublicUser(settlement.fromUser, 'ledger.settlement.fromUser');
        parsePublicUser(settlement.toUser, 'ledger.settlement.toUser');
        requireNumber(settlement, 'amount', 'ledger.settlement');
        requireString(settlement, 'currency', 'ledger.settlement');
        requireNumber(settlement, 'settledAt', 'ledger.settlement');
        if (entry.expense !== null) {
            throw new Error('ledger.expense must be null for SETTLEMENT');
        }
        return { id, type, groupId };
    }

    throw new Error('ledger.type must be EXPENSE or SETTLEMENT');
};

const parsePreviewPage = (value: unknown, label: string): ContractPage => {
    const response = requireRecord(value, label);
    const items = requireArray(response.items, `${label}.items`);
    const ids: string[] = [];
    for (let index = 0; index < items.length; index += 1) {
        const item = requireRecord(items[index], `${label}.items[${index}]`);
        ids.push(parseActivityEvent(item.parent, `${label}.items[${index}].parent`));
        parseActivityEvent(item.lastEvent, `${label}.items[${index}].lastEvent`);
    }
    const cursor = response.nextCursor;
    if (cursor !== null && (typeof cursor !== 'number' || !Number.isSafeInteger(cursor))) {
        throw new Error(`${label}.nextCursor must be a safe integer or null`);
    }
    return { ids, nextCursor: cursor };
};

export const parseActivityPage = (value: unknown): ContractPage => {
    const response = requireRecord(value, 'activity');
    const items = requireArray(response.items, 'activity.items');
    const ids: string[] = [];
    for (let index = 0; index < items.length; index += 1) {
        ids.push(parseActivityEvent(items[index], `activity.items[${index}]`));
    }
    const cursor = response.nextCursor;
    if (cursor !== null && (typeof cursor !== 'number' || !Number.isSafeInteger(cursor))) {
        throw new Error('activity.nextCursor must be a safe integer or null');
    }
    return { ids, nextCursor: cursor };
};

export const parseActivityPreviewPage = (value: unknown): ContractPage =>
    parsePreviewPage(value, 'activityPreviews');

export const parseDashboard = (value: unknown): void => {
    const dashboard = requireRecord(value, 'dashboard');
    requireRecord(dashboard.balances, 'dashboard.balances');
    parsePreviewPage(dashboard.activity, 'dashboard.activity');
    const groups = requireArray(dashboard.groups, 'dashboard.groups');
    if (groups.length !== 0) {
        throw new Error('dashboard.groups compatibility field must stay empty');
    }
};

export const parseCurrencyRates = (value: unknown): void => {
    const rates = requireRecord(value, 'currencyRates');
    requireString(rates, 'base', 'currencyRates');
    requireNumber(rates, 'timestamp', 'currencyRates');
    requireNumber(rates, 'fetchedAt', 'currencyRates');
    requireBoolean(rates, 'stale', 'currencyRates');
    const values = requireRecord(rates.rates, 'currencyRates.rates');
    if (typeof values.EUR !== 'number' || !Number.isFinite(values.EUR)) {
        throw new Error('currencyRates.rates.EUR must be a finite number');
    }
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
