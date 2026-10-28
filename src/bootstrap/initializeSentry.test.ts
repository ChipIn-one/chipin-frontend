import { beforeEach, expect, test, vi } from 'vitest';

import type { Breadcrumb, BrowserOptions, ErrorEvent } from '@sentry/react';

import { initializeSentry } from './initializeSentry';

const sentryMocks = vi.hoisted(() => ({
    init: vi.fn(),
}));

vi.mock('@sentry/react', () => ({
    init: sentryMocks.init,
}));

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';

const getOptions = (): BrowserOptions => {
    initializeSentry();
    const [options] = sentryMocks.init.mock.calls[0] as [BrowserOptions];
    return options;
};

beforeEach(() => {
    sentryMocks.init.mockReset();
});

test('sanitizes invite tokens in breadcrumb message and arbitrary data keys', () => {
    const { beforeBreadcrumb } = getOptions();
    const breadcrumb: Breadcrumb = {
        category: 'xhr',
        message: `POST /api/groups/invite/${TOKEN}`,
        data: {
            url: `/api/groups/invite/${TOKEN}`,
            requestPath: `/users/invite/${TOKEN}`,
            status_code: 200,
        },
    };

    expect(beforeBreadcrumb?.(breadcrumb)).toEqual({
        category: 'xhr',
        message: 'POST /api/groups/invite/:inviteToken',
        data: {
            url: '/api/groups/invite/:inviteToken',
            requestPath: '/users/invite/:inviteToken',
            status_code: 200,
        },
    });
});

test('drops console breadcrumbs', () => {
    const { beforeBreadcrumb } = getOptions();

    expect(beforeBreadcrumb?.({ category: 'console', message: 'x' })).toBeNull();
});

test('sanitizes invite tokens in event extra and tags', () => {
    const { beforeSend } = getOptions();
    const event: ErrorEvent = {
        type: undefined,
        extra: { url: `/api/groups/invite/${TOKEN}`, attempt: 2, __serialized__: 'raw' },
        tags: { route: `/group/join/${TOKEN}`, area: 'groups' },
        transaction: `/friends/join/${TOKEN}`,
    };

    const result = beforeSend?.(event, {});

    expect(result).toMatchObject({
        extra: { url: '/api/groups/invite/:inviteToken', attempt: 2 },
        tags: { route: '/group/join/:inviteToken', area: 'groups' },
        transaction: '/friends/join/:inviteToken',
    });
    expect(result).not.toHaveProperty('extra.__serialized__');
});
