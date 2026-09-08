import { getLocalUser } from 'helpers/localStorage';

import type { UsersStoreState } from './types';

const createInitialState = (): UsersStoreState => {
    const localUser = getLocalUser();

    return {
        user: null,
        localUser,
        friends: [],
    };
};

export { createInitialState };
