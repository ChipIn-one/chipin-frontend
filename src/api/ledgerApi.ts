import { apiPath } from './apiPath';
import { apiInstance } from './chipin.instance';
import type {
    ApiCreateLedgerResponse,
    CreateSettlementParams,
    FetchLedgerEntryParams,
    RemoveLedgerEntryParams,
} from './chipin.types';

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

export const removeLedgerEntry = ({ entryId }: RemoveLedgerEntryParams): Promise<void> => {
    return Promise.resolve()
        .then(() => apiInstance.delete<void>(apiPath`/ledger/entries/${entryId}`))
        .then(() => undefined);
};

export const fetchLedgerEntry = ({
    entryId,
}: FetchLedgerEntryParams): Promise<ApiCreateLedgerResponse> => {
    return Promise.resolve()
        .then(() => apiInstance.get<ApiCreateLedgerResponse>(apiPath`/ledger/entries/${entryId}`))
        .then(response => response.data);
};
