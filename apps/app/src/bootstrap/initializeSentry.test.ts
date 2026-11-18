import type { Breadcrumb, BrowserOptions, ErrorEvent } from '@sentry/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

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

const setWebdriver = (value: boolean | undefined): void => {
    Object.defineProperty(navigator, 'webdriver', { configurable: true, value });
};

beforeEach(() => {
    sentryMocks.init.mockReset();
});

afterEach(() => {
    Reflect.deleteProperty(navigator, 'webdriver');
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

// Issue ChipIn-one/chipin-frontend#754: e2e runs against Vercel previews must not report.
test('drops every event in an automation-driven browser', () => {
    setWebdriver(true);
    const { beforeSend } = getOptions();

    expect(beforeSend?.({ type: undefined, message: 'boom' }, {})).toBeNull();
});

test.each([false, undefined])('sends the event when navigator.webdriver is %s', value => {
    setWebdriver(value);
    const { beforeSend } = getOptions();

    expect(beforeSend?.({ type: undefined, message: 'boom' }, {})).toMatchObject({
        message: 'boom',
    });
});

test.each([
    [true, ['Dedupe']],
    [false, ['BrowserSession', 'Dedupe']],
])('with navigator.webdriver %s keeps integrations %j', (webdriver, expected) => {
    const defaults: Extract<BrowserOptions['integrations'], unknown[]> = [
        { name: 'BrowserSession' },
        { name: 'Dedupe' },
    ];
    setWebdriver(webdriver);
    const { integrations } = getOptions();

    expect(typeof integrations).toBe('function');
    const kept = typeof integrations === 'function' ? integrations(defaults) : [];

    expect(kept.map(({ name }) => name)).toEqual(expected);
});
