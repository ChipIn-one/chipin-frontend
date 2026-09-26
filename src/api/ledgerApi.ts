import { apiInstance } from './chipin.instance';
import type {
    ApiCreateLedgerResponse,
    CreateLedgerEntryParams,
    CreateSettlementParams,
    FetchLedgerEntryParams,
    RemoveLedgerEntryParams,
    SharingMode,
    UpdateLedgerExpenseParams,
} from './chipin.types';

export const createExpense = ({
    groupId,
    description,
    amount,
    date,
    payerId,
    participantIds,
    currency,
    category,
    sharingMode,
}: CreateLedgerEntryParams): Promise<ApiCreateLedgerResponse> => {
    const resolvedSharingMode: SharingMode = sharingMode ?? { type: 'AUTO' };

    return apiInstance
        .post<ApiCreateLedgerResponse>('/ledger/entries', {
            type: 'EXPENSE',
            ...(groupId && { groupId }),
            expense: {
                description,
                amount,
                date,
                payerId,
                participantIds,
                currency,
                category: category ?? null,
                sharingMode: resolvedSharingMode,
            },
        })
        .then(response => response.data);
};

export const createSettlement = ({
    groupId,
    fromUserId,
    toUserId,
    amount,
    currency,
}: CreateSettlementParams): Promise<ApiCreateLedgerResponse> => {
    return apiInstance
        .post<ApiCreateLedgerResponse>('/ledger/entries', {
            type: 'SETTLEMENT',
            ...(groupId && { groupId }),
            settlement: {
                fromUserId,
                toUserId,
                amount,
                currency,
            },
        })
        .then(response => response.data);
};

export const removeLedgerEntry = ({
    entryId,
}: RemoveLedgerEntryParams): Promise<void> => {
    return apiInstance.delete<void>(`/ledger/entries/${entryId}`).then(() => undefined);
};

export const fetchLedgerEntry = ({
    entryId,
}: FetchLedgerEntryParams): Promise<ApiCreateLedgerResponse> => {
    return apiInstance
        .get<ApiCreateLedgerResponse>(`/ledger/entries/${entryId}`)
        .then(response => response.data);
};

export const updateExpense = ({
    entryId,
    entry,
}: {
    entryId: string;
    entry: UpdateLedgerExpenseParams;
}): Promise<ApiCreateLedgerResponse> => {
    return apiInstance
        .patch<ApiCreateLedgerResponse>(`/ledger/entries/${entryId}`, entry)
        .then(response => response.data);
};
