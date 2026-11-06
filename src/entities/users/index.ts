// Public entry of entities/users: the self user (and its settings), the known users (friends) and
// the premium promo queries.
export {
    knownUsersQueryOptions,
    premiumPromoQueryOptions,
    selfUserQueryOptions,
    useKnownUsersQuery,
    usePremiumPromoQuery,
    USERS_QUERY_DEFAULTS,
    usersKeys,
    useSelfUserQuery,
} from './api/queries';
export type { FriendCurrencyGroup, FriendsView } from './model/friendsView';
export { getFriendsView, hasOutstandingDebt } from './model/friendsView';
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
export type { KnownUser, KnownUserProfile, SelfUser, SelfUserSettings } from './model/types';
