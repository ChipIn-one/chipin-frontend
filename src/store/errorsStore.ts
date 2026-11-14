import { create } from 'zustand';

import type { RequestError } from 'helpers/errors';

interface RequestErrors {
    auth: {
        login: RequestError | null;
        signOut: RequestError | null;
        logoutOtherDevices: RequestError | null;
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
