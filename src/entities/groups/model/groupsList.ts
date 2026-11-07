// Reading and editing the cached pages of the groups list: the readers see one list without
// duplicates, and the legacy group writes (03-11) replace, add or drop one group in place.
import type { InfiniteData } from '@tanstack/react-query';

import type { Group } from 'api/chipin.types';

import type { GroupsListPage } from './types';

export type GroupsListData = InfiniteData<GroupsListPage, string | null>;

/** The groups of all loaded pages in order; a group repeated by a later page keeps its first place. */
export const flattenGroupsList = (data: GroupsListData): Group[] => {
    const seen = new Set<string>();
    const groups: Group[] = [];

    for (const page of data.pages) {
        for (const group of page.items) {
            if (!seen.has(group.id)) {
                seen.add(group.id);
                groups.push(group);
            }
        }
    }
    return groups;
};

const mapPages = (
    data: GroupsListData,
    mapItems: (items: readonly Group[], index: number) => readonly Group[],
): GroupsListData => ({
    pages: data.pages.map((page, index) => ({ ...page, items: mapItems(page.items, index) })),
    pageParams: data.pageParams,
});

/** Replaces the group wherever it is listed; a group not listed yet goes to the end of the last page. */
export const upsertGroupInList = (data: GroupsListData, group: Group): GroupsListData => {
    const isListed = data.pages.some(page => page.items.some(item => item.id === group.id));

    if (isListed) {
        return mapPages(data, items => items.map(item => (item.id === group.id ? group : item)));
    }
    const lastIndex = data.pages.length - 1;

    return mapPages(data, (items, index) => (index === lastIndex ? [...items, group] : items));
};

export const removeGroupFromList = (data: GroupsListData, groupId: string): GroupsListData =>
    mapPages(data, items => items.filter(item => item.id !== groupId));
