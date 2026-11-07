import { dehydrate, InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import type { Group } from 'api/chipin.types';
import { dehydrateOptions, trimInfinitePages } from 'shared/offline/queryPersister';
import { setupMswServer } from 'test/mswServer';

import {
    flattenGroupsList,
    type GroupsListData,
    removeGroupFromList,
    upsertGroupInList,
} from '../model/groupsList';

import { groupsKeys, groupsListQueryOptions } from './queries';

const server = setupMswServer();

const group = (id: string, name = `Group ${id}`) => ({ id, name }) as unknown as Group;

const listData = (...pages: Group[][]): GroupsListData => ({
    pages: pages.map((items, index) => ({
        items,
        nextCursor: index < pages.length - 1 ? `cursor-${String(index + 1)}` : null,
    })),
    pageParams: pages.map((_items, index) => (index === 0 ? null : `cursor-${String(index)}`)),
});

test("groups keys share the 'groups' root and the list stays fresh for 60 s", () => {
    expect(groupsKeys.all).toEqual(['groups']);
    expect(groupsKeys.list()).toEqual(['groups', 'list']);
    expect(groupsKeys.detail('g-1')).toEqual(['groups', 'detail', 'g-1']);
    expect(groupsKeys.activity('g-1')).toEqual(['groups', 'activity', 'g-1']);
    expect(groupsListQueryOptions().staleTime).toBe(60_000);
});

test('pages the list by its opaque cursor and persists only the first page', async () => {
    const cursors: (string | null)[] = [];

    server.use(
        http.get('*/groups', ({ request }) => {
            const cursor = new URL(request.url).searchParams.get('cursor');

            cursors.push(cursor);
            return HttpResponse.json(
                cursor === null
                    ? { items: [group('a')], nextCursor: 'opaque:b' }
                    : { items: [group('b')], nextCursor: null },
            );
        }),
    );
    const client = new QueryClient();
    const observer = new InfiniteQueryObserver(client, groupsListQueryOptions());

    await observer.refetch();
    await observer.fetchNextPage();

    expect(cursors).toEqual([null, 'opaque:b']);
    const persisted = trimInfinitePages({
        timestamp: 0,
        buster: '',
        clientState: dehydrate(client, dehydrateOptions),
    });

    expect(persisted.clientState.queries[0]?.state.data).toEqual({
        pages: [{ items: [group('a')], nextCursor: 'opaque:b' }],
        pageParams: [null],
    });
});

test('reads one list without duplicates, a repeated group keeping its first place', () => {
    const first = group('a', 'First copy');

    expect(
        flattenGroupsList(listData([first, group('b')], [group('a', 'Later'), group('c')])),
    ).toEqual([first, group('b'), group('c')]);
});

test('replaces a listed group in place and adds an unlisted one at the end', () => {
    const renamed = group('a', 'Renamed');
    const data = listData([group('a'), group('b')], [group('c')]);

    expect(upsertGroupInList(data, renamed).pages.map(page => page.items)).toEqual([
        [renamed, group('b')],
        [group('c')],
    ]);
    expect(upsertGroupInList(data, group('d')).pages.map(page => page.items)).toEqual([
        [group('a'), group('b')],
        [group('c'), group('d')],
    ]);
    expect(upsertGroupInList(data, group('d')).pageParams).toBe(data.pageParams);
});

test('drops a group from every page', () => {
    const data = listData([group('a'), group('b')], [group('a')]);

    expect(removeGroupFromList(data, 'a').pages.map(page => page.items)).toEqual([
        [group('b')],
        [],
    ]);
});
