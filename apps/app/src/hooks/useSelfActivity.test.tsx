import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, test } from 'vitest';

import { activityKeys } from 'entities/activity';
import { useAuthStore } from 'store/authStore';
import { domainPreview } from 'test/activityFixtures';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import { useSelfActivityLog } from './useSelfActivity';

const server = setupMswServer();

afterEach(() => {
    useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
});

test.each([
    ['expired', true],
    ['invalid', true],
    ['signed_out', false],
    ['missing', false],
] as const)(
    'AUTH-077: with reason %s the cached activity log is shown: %s, with no request',
    async (reason, isShown) => {
        let requests = 0;
        server.use(
            http.get('*/users/self/*', () => {
                requests += 1;
                return HttpResponse.json({ items: [], nextCursor: null });
            }),
        );
        const client = mountAsUserClient();
        const { lastEvent } = domainPreview('activity-1');
        client.setQueryData(activityKeys.self({ view: 'events' }), {
            pages: [{ items: [lastEvent], nextCursor: null }],
            pageParams: [null],
        });
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: reason });

        const { result } = renderHook(() => useSelfActivityLog());

        expect(result.current.events.map(event => event.id)).toEqual(isShown ? [lastEvent.id] : []);
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(requests).toBe(0);
    },
);
