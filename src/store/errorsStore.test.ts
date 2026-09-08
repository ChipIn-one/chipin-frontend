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

        useErrorsStore.getState().setError('activity', 'data', error);

        expect(useErrorsStore.getState().errors.activity.data).toEqual(error);

        useErrorsStore.getState().clearError('activity', 'data');

        expect(useErrorsStore.getState().errors.activity.data).toBeNull();
    });

    test('resets all request errors', () => {
        useErrorsStore.getState().setError('group', 'list', {
            message: 'Groups unavailable',
        });

        useErrorsStore.getState().resetErrors();

        expect(useErrorsStore.getState().errors.group.list).toBeNull();
    });
});
