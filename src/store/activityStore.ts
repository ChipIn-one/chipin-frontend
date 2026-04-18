import { create } from 'zustand';

import { AppEvent } from 'api/activity.types';
import { createApiLedgerEntry } from 'api/chipin';
import { ApiActivityResponse } from 'api/chipin.types';

export interface ActivityStore {
    items: AppEvent[];
    nextCursor: string | null;

    setActivity: (activity: ApiActivityResponse) => void;
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

const initialActivityStore = {
    items: [],
    nextCursor: null,
};

export const useActivityStore = create<ActivityStore>(set => ({
    ...initialActivityStore,

    setActivity: (activity: ApiActivityResponse) => {
        set({ ...activity });
    },
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
