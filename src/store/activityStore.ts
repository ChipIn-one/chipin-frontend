import { create } from 'zustand';

import { createApiLedgerEntry } from 'api/chipin';

export interface DashboardStore {
    createExpense: ({
        groupId,
        description,
        amount,
        unixTimestamp,
        payerId,
        participantIds,
        currency,
    }: {
        groupId: string;
        description: string;
        amount: string | number;
        unixTimestamp: number;
        payerId: string;
        participantIds: string[];
        currency: string; // TODO: currencyCode
    }) => void;
}

const initialActivityStore = {};

export const useActivityStore = create<DashboardStore>(() => ({
    ...initialActivityStore,

    createExpense: params => {
        // set({ isLoadingDashboard: true });

        // add handling of offline mode
        createApiLedgerEntry(params)
            .then(data => {
                console.log(data);
            })
            .catch(error => {
                console.error('Error creating expense', error);
            })
            .finally(() => {
                // set({ isLoadingDashboard: false });
            });
    },
}));
