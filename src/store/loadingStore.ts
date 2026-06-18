import { create } from 'zustand';

export type LoadingState = 'initial' | 'loading' | 'fetched';

export interface LoadingStore {
    auth: {
        login: LoadingState;
    };
    group: {
        data: LoadingState;
        add: LoadingState;
        update: LoadingState;
        remove: LoadingState;
        join: LoadingState;
        leave: LoadingState;
        kick: LoadingState;
    };
    dashboard: {
        data: LoadingState;
    };
    activity: {
        data: LoadingState;
        nextPage: LoadingState;
    };
    expense: {
        add: LoadingState;
    };
    users: {
        self: LoadingState;
        friends: LoadingState;
    };

    setLoading: <S extends keyof LoadingStore, F extends keyof LoadingStore[S]>(
        section: S,
        field: F,
        value: LoadingState,
    ) => void;
}

type LoadingSlices = Omit<LoadingStore, 'setLoading'>;

const initialLoadingStore: LoadingSlices = {
    auth: { login: 'initial' },
    dashboard: { data: 'initial' },
    activity: { data: 'initial', nextPage: 'initial' },
    expense: { add: 'initial' },
    group: {
        data: 'initial',
        add: 'initial',
        join: 'initial',
        remove: 'initial',
        update: 'initial',
        leave: 'initial',
        kick: 'initial',
    },
    users: { self: 'initial', friends: 'initial' },
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
}));
