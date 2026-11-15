import { afterEach, describe, expect, test } from 'vitest';

import { useErrorsStore } from './errorsStore';

afterEach(() => {
    useErrorsStore.getState().resetErrors();
});

describe('errors store', () => {
    test('stores and clears a request error by operation', () => {
        const error = {
            code: 'AUTH.UNAVAILABLE',
            message: 'Sign-in is unavailable',
        };

        useErrorsStore.getState().setError('auth', 'login', error);

        expect(useErrorsStore.getState().errors.auth.login).toEqual(error);

        useErrorsStore.getState().clearError('auth', 'login');

        expect(useErrorsStore.getState().errors.auth.login).toBeNull();
    });

    test('resets all request errors', () => {
        useErrorsStore.getState().setError('auth', 'signOut', {
            message: 'Sign-out unavailable',
        });

        useErrorsStore.getState().resetErrors();

        expect(useErrorsStore.getState().errors.auth.signOut).toBeNull();
    });
});
