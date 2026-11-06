import { getLocalUser } from 'helpers/localStorage';

import type { UsersStoreState } from './types';

const createInitialState = (): UsersStoreState => {
    const localUser = getLocalUser();

    return {
        user: null,
        hasConfirmedUser: false,
        localUser,
    };
};

export { createInitialState };
