import { afterEach, describe, expect, test } from 'vitest';

import { useErrorsStore } from './errorsStore';

afterEach(() => {
    useErrorsStore.getState().resetErrors();
});

describe('errors store', () => {
    test('stores and clears a request error by operation', () => {
        const error = {
            code: 'ACTIVITY.UNAVAILABLE',
            message: 'Activity is unavailable',
        };

        useErrorsStore.getState().setError('activity', 'subeventsData', error);

        expect(useErrorsStore.getState().errors.activity.subeventsData).toEqual(error);

        useErrorsStore.getState().clearError('activity', 'subeventsData');

        expect(useErrorsStore.getState().errors.activity.subeventsData).toBeNull();
    });

    test('resets all request errors', () => {
        useErrorsStore.getState().setError('expense', 'update', {
            message: 'Expense unavailable',
        });

        useErrorsStore.getState().resetErrors();

        expect(useErrorsStore.getState().errors.expense.update).toBeNull();
    });
});
