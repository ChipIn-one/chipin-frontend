import { create } from 'zustand';

import type { RequestError } from 'helpers/errors';

interface RequestErrors {
    auth: {
        login: RequestError | null;
        signOut: RequestError | null;
        logoutOtherDevices: RequestError | null;
    };
    group: {
        list: RequestError | null;
        data: RequestError | null;
        nextPage: RequestError | null;
        add: RequestError | null;
        update: RequestError | null;
        remove: RequestError | null;
        join: RequestError | null;
        leave: RequestError | null;
        kick: RequestError | null;
        cover: RequestError | null;
    };
    dashboard: {
        data: RequestError | null;
        nextPage: RequestError | null;
    };
    landing: {
        stats: RequestError | null;
    };
    activity: {
        data: RequestError | null;
        nextPage: RequestError | null;
        subeventsData: RequestError | null;
        subeventsNextPage: RequestError | null;
    };
    expense: {
        add: RequestError | null;
        edit: RequestError | null;
        update: RequestError | null;
    };
    ledger: {
        remove: RequestError | null;
    };
    settlement: {
        add: RequestError | null;
    };
    users: {
        self: RequestError | null;
        friends: RequestError | null;
        settings: RequestError | null;
        removeFriend: RequestError | null;
        avatar: RequestError | null;
    };
}

type ErrorSection = keyof RequestErrors;
type ErrorField<S extends ErrorSection> = keyof RequestErrors[S];

export interface ErrorsStore {
    errors: RequestErrors;
    setError: <S extends ErrorSection>(
        section: S,
        field: ErrorField<S>,
        error: RequestError,
    ) => void;
    clearError: <S extends ErrorSection>(section: S, field: ErrorField<S>) => void;
    resetErrors: () => void;
}

const initialErrors: RequestErrors = {
    auth: { login: null, signOut: null, logoutOtherDevices: null },
    group: {
        list: null,
        data: null,
        nextPage: null,
        add: null,
        update: null,
        remove: null,
        join: null,
        leave: null,
        kick: null,
        cover: null,
    },
    dashboard: { data: null, nextPage: null },
    landing: { stats: null },
    activity: {
        data: null,
        nextPage: null,
        subeventsData: null,
        subeventsNextPage: null,
    },
    expense: { add: null, edit: null, update: null },
    ledger: { remove: null },
    settlement: { add: null },
    users: { self: null, friends: null, settings: null, removeFriend: null, avatar: null },
};

export const useErrorsStore = create<ErrorsStore>((set, get) => ({
    errors: initialErrors,
    setError: (section, field, error) => {
        set({
            errors: {
                ...get().errors,
                [section]: {
                    ...get().errors[section],
                    [field]: error,
                },
            },
        } as Pick<ErrorsStore, 'errors'>);
    },
    clearError: (section, field) => {
        set({
            errors: {
                ...get().errors,
                [section]: {
                    ...get().errors[section],
                    [field]: null,
                },
            },
        } as Pick<ErrorsStore, 'errors'>);
    },
    resetErrors: () => {
        set({ errors: initialErrors });
    },
}));
