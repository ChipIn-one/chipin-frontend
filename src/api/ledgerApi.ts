import { apiInstance } from './chipin.instance';
import type {
    ApiCreateLedgerResponse,
    CreateLedgerEntryParams,
    CreateSettlementParams,
    RemoveLedgerEntryParams,
    SharingMode,
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
