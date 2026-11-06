// Public entry of entities/users: the self user query and the settings it carries.
export {
    selfUserQueryOptions,
    USERS_QUERY_DEFAULTS,
    usersKeys,
    useSelfUserQuery,
} from './api/queries';
export {
    canRoleAccessSolo,
    isAdminRole,
    isUserTime24H,
    userCurrency,
    userDefaultCategory,
    userLanguage,
    userSaveGroupExpensesToSolo,
    userSex,
    userSimplifyDebts,
    userSkipCategory,
    userSoloModeByDefault,
    userTheme,
} from './model/settings';
export type { SelfUser, SelfUserSettings } from './model/types';
