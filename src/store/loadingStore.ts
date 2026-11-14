import { create } from 'zustand';

export type LoadingState = 'initial' | 'loading' | 'fetched';

export interface LoadingStore {
    auth: {
        login: LoadingState;
        signOut: LoadingState;
        logoutOtherDevices: LoadingState;
    };
    activity: {
        data: LoadingState;
        nextPage: LoadingState;
        subeventsData: LoadingState;
        subeventsNextPage: LoadingState;
    };
    expense: {
        add: LoadingState;
        edit: LoadingState;
        update: LoadingState;
    };
    ledger: {
        remove: LoadingState;
    };
    settlement: {
        add: LoadingState;
    };

    setLoading: <S extends keyof LoadingStore, F extends keyof LoadingStore[S]>(
        section: S,
        field: F,
        value: LoadingState,
    ) => void;
    setInitialLoadingStore: () => void;
}

type LoadingSlices = Omit<LoadingStore, 'setLoading' | 'setInitialLoadingStore'>;

const initialLoadingStore: LoadingSlices = {
    auth: { login: 'initial', signOut: 'initial', logoutOtherDevices: 'initial' },
    activity: {
        data: 'initial',
        nextPage: 'initial',
        subeventsData: 'initial',
        subeventsNextPage: 'initial',
    },
    expense: { add: 'initial', edit: 'initial', update: 'initial' },
    ledger: { remove: 'initial' },
    settlement: { add: 'initial' },
};

export const useLoadingStore = create<LoadingStore>((set, get) => ({
    ...initialLoadingStore,

    setLoading: (section, field, value) => {
        set({
            [section]: {
                ...get()[section],
                [field]: value,
            },
        } as Pick<LoadingStore, typeof section>);
    },
    setInitialLoadingStore: () => {
        set(initialLoadingStore);
    },
}));
