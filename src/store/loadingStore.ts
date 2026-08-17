import { create } from 'zustand';

export type LoadingState = 'initial' | 'loading' | 'fetched';

export interface LoadingStore {
    auth: {
        login: LoadingState;
        signOut: LoadingState;
        logoutOtherDevices: LoadingState;
    };
    group: {
        list: LoadingState;
        data: LoadingState;
        add: LoadingState;
        update: LoadingState;
        remove: LoadingState;
        join: LoadingState;
        leave: LoadingState;
        kick: LoadingState;
        cover: LoadingState;
    };
    dashboard: {
        data: LoadingState;
        nextPage: LoadingState;
    };
    landing: {
        stats: LoadingState;
    };
    activity: {
        data: LoadingState;
        nextPage: LoadingState;
        selectedEvent: LoadingState;
        subeventsData: LoadingState;
        subeventsNextPage: LoadingState;
    };
    expense: {
        add: LoadingState;
    };
    ledger: {
        remove: LoadingState;
    };
    settlement: {
        add: LoadingState;
    };
    users: {
        self: LoadingState;
        friends: LoadingState;
        removeFriend: LoadingState;
        avatar: LoadingState;
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
    dashboard: { data: 'initial', nextPage: 'initial' },
    landing: { stats: 'initial' },
    activity: {
        data: 'initial',
        nextPage: 'initial',
        selectedEvent: 'initial',
        subeventsData: 'initial',
        subeventsNextPage: 'initial',
    },
    expense: { add: 'initial' },
    ledger: { remove: 'initial' },
    settlement: { add: 'initial' },
    group: {
        list: 'initial',
        data: 'initial',
        add: 'initial',
        join: 'initial',
        remove: 'initial',
        update: 'initial',
        leave: 'initial',
        kick: 'initial',
        cover: 'initial',
    },
    users: {
        self: 'initial',
        friends: 'initial',
        removeFriend: 'initial',
        avatar: 'initial',
    },
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
