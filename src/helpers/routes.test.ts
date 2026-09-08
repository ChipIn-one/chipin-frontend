import { expect, test } from 'vitest';

import {
    getBreadcrumbParentPath,
    getHasDesktopSidebar,
    getPreferredModeRoute,
} from './routes';

test('selects the Solo route when Solo Mode is the user default', () => {
    expect(getPreferredModeRoute(true)).toBe('/solo');
    expect(getPreferredModeRoute(false)).toBe('/dashboard');
});

test.each([
    ['/dashboard', true],
    ['/dashboard/', true],
    ['/solo', true],
    ['/group/group-1', true],
    ['/activity', true],
    ['/activity/activity-1', true],
    ['/activity/activity-1/details', false],
    ['/group/group-1/details', false],
    ['/friends', true],
    ['/friends/', true],
    ['/settings', true],
    ['/group/join/invite-token', false],
    ['/', false],
    ['/sign-in', false],
    ['/oauth/callback', false],
    ['/not-found', false],
] as const)('returns desktop sidebar availability for %s', (pathname, expected) => {
    expect(getHasDesktopSidebar(pathname)).toBe(expected);
});

test.each([
    ['/activity/activity-1', '/activity'],
    ['/activity/activity-1/details', null],
    ['/activity', null],
    ['/group/group-1', null],
    ['/settings', null],
] as const)('resolves the configured breadcrumb parent for %s', (pathname, expected) => {
    expect(getBreadcrumbParentPath(pathname)).toBe(expected);
});
