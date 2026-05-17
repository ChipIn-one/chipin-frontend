import { UsersStore } from './usersStore';

export const selectUserCurrency = (s: UsersStore) => s.settings.defaultCurrency;
