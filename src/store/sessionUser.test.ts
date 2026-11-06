// The session self loader (spec 03 §1.5, §6 row 3): one `GET /users/self` per session start, and a
// load that started before a confirmed self write never overwrites it (cache or `LocalUser`).
import { MutationObserver, type QueryClient, QueryObserver } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { LS_KEY_USER } from 'constants/localstorage';
import {
    type SelfUser,
    selfUserQueryOptions,
    updateSelfMutationOptions,
    usersKeys,
} from 'entities/users';
import { getAuthSessionVersion, invalidateAuthSession } from 'helpers/authSession';
import {
    clearLocalUserIdentity,
    getLocalUser,
    getTabUserId,
    LocalStorage,
    saveLocalUser,
    subscribeTabUserId,
} from 'helpers/localStorage';
import { takePendingSeed } from 'shared/offline/userCaches';
import { setupMswServer } from 'test/mswServer';
import { createTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import { getSessionSelfLoad, loadSelfUserForSession, resetSessionSelfLoad } from './sessionUser';

const server = setupMswServer();

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'light',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} as const;

const userOf = (id: string, theme: 'light' | 'dark' = 'light'): SelfUser => ({
    id,
    email: `${id}@example.com`,
    displayName: id,
    picture: null,
    role: 'ADMIN',
    subscriptionUntil: null,
    inviteToken: `invite-${id}`,
    settings: { ...settings, theme },
    createdAt: 1,
    updatedAt: 1,
});

interface SelfServer {
    count: () => number;
    /** Answers the held requests (`hold: true`) in order. */
    release: () => void;
}

/** `GET /users/self` answering `user()` at answer time; `hold` keeps each answer until release. */
const serveSelf = (user: () => SelfUser, { hold = false } = {}): SelfServer => {
    let count = 0;
    const waiting: (() => void)[] = [];

    server.use(
        http.get('*/users/self', async () => {
            count += 1;
            if (hold) {
                await new Promise<void>(resolve => {
                    waiting.push(resolve);
                });
            }
            return HttpResponse.json({ ...user(), isPremium: false });
        }),
    );
    return {
        count: () => count,
        release: () => {
            waiting.splice(0).forEach(resolve => {
                resolve();
            });
        },
    };
};

/** `PATCH /users/self` answering the server user with the body applied. */
const servePatch = (serverUser: { current: SelfUser }): void => {
    server.use(
        http.patch('*/users/self', async ({ request }) => {
            const body = (await request.json()) as { settings?: Partial<SelfUser['settings']> };

            serverUser.current = {
                ...serverUser.current,
                settings: { ...serverUser.current.settings, ...body.settings },
            };
            return HttpResponse.json({ ...serverUser.current, isPremium: false });
        }),
    );
};

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

const STALE = Date.now() - 60 * 60_000;

// A mounted reader of `users.self` (as `useSelfUser` on the user's client): its mount refetches a
// stale entry.
const mountReader = (client: QueryClient): (() => void) =>
    new QueryObserver(client, selfUserQueryOptions()).subscribe(() => undefined);

const writeTheme = (client: QueryClient, theme: 'light' | 'dark') =>
    new MutationObserver(client, updateSelfMutationOptions()).mutate({
        changes: { settings: { theme } },
        sessionVersion: getAuthSessionVersion(),
    });

const unsubscribers: (() => void)[] = [];

beforeEach(() => {
    LocalStorage.remove(LS_KEY_USER);
});

afterEach(() => {
    unsubscribers.splice(0).forEach(unsubscribe => {
        unsubscribe();
    });
    ['user-x', 'user-y'].forEach(id => takePendingSeed(id));
});

describe('one GET /users/self per session start', () => {
    test('an existing session: the mount of the restored (stale) user joins the session load', async () => {
        const self = serveSelf(() => userOf('user-x'));
        saveLocalUser({ id: 'user-x', role: 'ADMIN', settings });
        const client = mountAsUserClient('user-x', createTestQueryClient());
        client.setQueryData(usersKeys.self(), userOf('user-x'), { updatedAt: STALE });

        const loaded = loadSelfUserForSession();
        unsubscribers.push(mountReader(client));

        expect((await loaded)?.id).toBe('user-x');
        await settle();
        expect(self.count()).toBe(1);
    });

    test('a first sign-in: the new client gets the user with no request of its own', async () => {
        const self = serveSelf(() => userOf('user-x'));
        saveLocalUser({ settings });

        expect((await loadSelfUserForSession())?.id).toBe('user-x');
        // `LocalUser` and this tab's user: the app remounts onto the user's client.
        expect(getLocalUser()).toEqual({ id: 'user-x', role: 'ADMIN', settings });
        expect(getTabUserId()).toBe('user-x');

        // The remount creates the client (as `restore` does) and mounts a reader.
        const client = createTestQueryClient();
        takePendingSeed('user-x')?.(client);
        mountAsUserClient('user-x', client);
        unsubscribers.push(mountReader(client));
        await settle();

        expect(client.getQueryData(usersKeys.self())).toEqual(userOf('user-x'));
        expect(self.count()).toBe(1);
    });

    test('an account switch: the new client created during the load joins it', async () => {
        const self = serveSelf(() => userOf('user-y'), { hold: true });
        // `dropOtherUserData` has made Y this tab's user; Y's client is still to come.
        saveLocalUser({ id: 'user-y', settings });

        const loaded = loadSelfUserForSession();
        await settle();
        const client = createTestQueryClient();
        takePendingSeed('user-y')?.(client);
        mountAsUserClient('user-y', client);
        unsubscribers.push(mountReader(client));
        await settle();
        self.release();

        expect((await loaded)?.id).toBe('user-y');
        await settle();
        expect(client.getQueryData(usersKeys.self())).toEqual(userOf('user-y'));
        expect(getLocalUser()?.role).toBe('ADMIN');
        expect(self.count()).toBe(1);
    });

    test.each([
        { name: 'finished before', hold: false },
        { name: 'still running at', hold: true },
    ])(
        'an offline-cached reconnect: the reconnect refetch $name the session start is reused',
        async ({ hold }) => {
            const self = serveSelf(() => userOf('user-x'), { hold });
            saveLocalUser({ id: 'user-x', role: 'ADMIN', settings });
            const client = mountAsUserClient('user-x', createTestQueryClient());
            client.setQueryData(usersKeys.self(), userOf('user-x'), { updatedAt: STALE });
            // The session start began before the refresh; the reconnect refetched meanwhile (a
            // mounted reader of the stale entry).
            const since = Date.now();
            unsubscribers.push(mountReader(client));
            await settle();

            const loaded = loadSelfUserForSession(since);
            self.release();

            expect((await loaded)?.id).toBe('user-x');
            await settle();
            expect(self.count()).toBe(1);
        },
    );
});

describe('a load that started before a confirmed self write', () => {
    test('on the existing client: neither the cache nor LocalUser get the stale user', async () => {
        const serverUser = { current: userOf('user-x') };
        // The load reads the user before the write; its answer arrives after the write.
        const staleAnswer = serverUser.current;
        const self = serveSelf(() => staleAnswer, { hold: true });
        servePatch(serverUser);
        saveLocalUser({ id: 'user-x', role: 'ADMIN', settings });
        const client = mountAsUserClient('user-x', createTestQueryClient());
        client.setQueryData(usersKeys.self(), userOf('user-x'), { updatedAt: STALE });

        const loaded = loadSelfUserForSession();
        await settle();
        await writeTheme(client, 'dark');
        self.release();
        await loaded;
        await settle();

        expect(client.getQueryData<SelfUser>(usersKeys.self())?.settings.theme).toBe('dark');
        expect(getLocalUser()?.settings.theme).toBe('dark');
        expect(self.count()).toBe(1);
    });

    test('before the client existed (account switch): the stale answer writes nothing', async () => {
        const serverUser = { current: userOf('user-y') };
        const staleAnswer = serverUser.current;
        const self = serveSelf(() => staleAnswer, { hold: true });
        servePatch(serverUser);
        saveLocalUser({ id: 'user-y', settings });

        const loaded = loadSelfUserForSession();
        await settle();
        const client = createTestQueryClient();
        takePendingSeed('user-y')?.(client);
        mountAsUserClient('user-y', client);
        // The joined load is in the cache only once it answers: the write needs a user first.
        client.setQueryData(usersKeys.self(), userOf('user-y'), { updatedAt: STALE });
        await writeTheme(client, 'dark');
        self.release();
        await loaded;
        await settle();

        expect(client.getQueryData<SelfUser>(usersKeys.self())?.settings.theme).toBe('dark');
        expect(getLocalUser()?.settings.theme).toBe('dark');
        // The role an expiry or the switch dropped still comes back.
        expect(getLocalUser()?.role).toBe('ADMIN');
    });
});

test('a load whose session ended (signed out, expired) writes nothing', async () => {
    const self = serveSelf(() => userOf('user-x'), { hold: true });
    saveLocalUser({ settings });

    const loaded = loadSelfUserForSession();
    await settle();
    invalidateAuthSession();
    self.release();
    await loaded;

    expect(getLocalUser()).toEqual({ settings });
    expect(getTabUserId()).toBeUndefined();
});

test('a session start brings back the role an expiry dropped', async () => {
    serveSelf(() => userOf('user-x'));
    saveLocalUser({ id: 'user-x', settings });
    mountAsUserClient('user-x', createTestQueryClient());

    await loadSelfUserForSession();

    expect(getLocalUser()).toEqual({ id: 'user-x', role: 'ADMIN', settings });
});

test("this tab's user follows only this tab's writes, and notifies its readers", () => {
    saveLocalUser({ id: 'user-x', settings });
    let notified = 0;
    const unsubscribe = subscribeTabUserId(() => {
        notified += 1;
    });

    // Another tab switches the shared `LocalUser`: this tab stays on X.
    LocalStorage.set(LS_KEY_USER, { id: 'user-y', settings });
    expect(getTabUserId()).toBe('user-x');
    expect(notified).toBe(0);

    saveLocalUser({ id: 'user-y', settings });
    expect(getTabUserId()).toBe('user-y');
    expect(notified).toBe(1);
    unsubscribe();
});

test("after this tab's sign-out, another tab's sign-in does not become this tab's user", () => {
    saveLocalUser({ id: 'user-x', settings });
    clearLocalUserIdentity();

    LocalStorage.set(LS_KEY_USER, { id: 'user-y', settings });

    expect(getTabUserId()).toBeUndefined();
});

test('with a self write pending the load is skipped, but the role still comes back', async () => {
    const self = serveSelf(() => userOf('user-x'));
    const serverUser = { current: userOf('user-x') };
    let answerPatch: () => void = () => undefined;
    server.use(
        http.patch('*/users/self', async () => {
            await new Promise<void>(resolve => {
                answerPatch = resolve;
            });
            return HttpResponse.json({ ...serverUser.current, isPremium: false });
        }),
    );
    saveLocalUser({ id: 'user-x', settings });
    const client = mountAsUserClient('user-x', createTestQueryClient());
    client.setQueryData(usersKeys.self(), userOf('user-x'));
    const write = writeTheme(client, 'dark');
    await settle();

    const loaded = await loadSelfUserForSession();

    expect(loaded?.settings.theme).toBe('dark');
    expect(getLocalUser()?.role).toBe('ADMIN');
    expect(self.count()).toBe(0);
    answerPatch();
    await write;
});

test('the session load state: loading, then loaded or failed (latest load only)', async () => {
    resetSessionSelfLoad();
    server.use(http.get('*/users/self', () => HttpResponse.json({}, { status: 500 })));
    saveLocalUser({ settings });

    const failed = loadSelfUserForSession();
    expect(getSessionSelfLoad().status).toBe('loading');
    await failed;
    expect(getSessionSelfLoad()).toEqual({ status: 'failed', user: null });

    serveSelf(() => userOf('user-x'));
    await loadSelfUserForSession();
    expect(getSessionSelfLoad()).toMatchObject({ status: 'loaded', user: { id: 'user-x' } });
});
