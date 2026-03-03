import { create } from 'zustand';

interface LoadingStore {
    group: {
        add: boolean;
        update: boolean;
        remove: boolean;
        join: boolean;
    };
    dashboard: {
        data: boolean;
    };
    users: {
        self: boolean;
        friends: boolean;
    };

    setLoading: <S extends keyof LoadingStore, F extends keyof LoadingStore[S]>(
        section: S,
        field: F,
        value: boolean,
    ) => void;
}

const initialLoadingStore = {
    dashboard: {
        data: false,
    },
    group: {
        add: false,
        join: false,
        remove: false,
        update: false,
    },
    users: {
        friends: false,
        self: false,
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
}));
