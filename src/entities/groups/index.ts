// Public entry of entities/groups: the groups list query and the edits of its cached pages.
export {
    GROUPS_LIST_STALE_TIME,
    groupsKeys,
    groupsListQueryOptions,
    useGroupsListQuery,
} from './api/queries';
export type { GroupsListData } from './model/groupsList';
export { flattenGroupsList, removeGroupFromList, upsertGroupInList } from './model/groupsList';
export type { GroupsListPage } from './model/types';
