// Test support for the self user: signed in on the user's persisted client with `users.self`
// cached, and a `PATCH /users/self` that records each body and answers with the cached user (the
// optimistic update has applied the body already).
import type { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { SetupServer } from 'msw/node';

import { type SelfUser, usersKeys } from 'entities/users';
import { useAuthStore } from 'store/authStore';

import { mountAsUserClient } from './userClient';

export const signInWithSelf = (user: SelfUser): QueryClient => {
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    const client = mountAsUserClient(user.id);

    client.setQueryData(usersKeys.self(), user);
    return client;
};

/** The bodies of the `PATCH /users/self` requests, in order. */
export const serveSelfUpdates = (server: SetupServer, client: QueryClient): unknown[] => {
    const bodies: unknown[] = [];

    server.use(
        http.patch('*/users/self', async ({ request }) => {
            bodies.push(await request.json());
            return HttpResponse.json({
                ...client.getQueryData<SelfUser>(usersKeys.self()),
                isPremium: false,
            });
        }),
    );
    return bodies;
};
