import { describe, expect, test } from 'vitest';

import { isVersionBelowMinimum, parseVersionCore } from './clientVersion';

describe('03-20 / API-001 parseVersionCore', () => {
    test.each<[string, readonly [number, number, number]]>([
        ['1.2.3', [1, 2, 3]],
        ['1.2.0-dev-abc1234', [1, 2, 0]],
        ['10.0.7-rc-1', [10, 0, 7]],
    ])('reads the core of %s', (value, core) => {
        expect(parseVersionCore(value)).toEqual(core);
    });

    test.each(['', 'abc', '1.2', '1.2.3.4', 'v1.2.3', '1.x.3', '-1.2.3', '1..3'])(
        'rejects the malformed value %j',
        value => {
            expect(parseVersionCore(value)).toBeNull();
        },
    );
});

describe('03-20 / API-004 isVersionBelowMinimum', () => {
    test('equal cores: not below', () => {
        expect(isVersionBelowMinimum('1.2.0', '1.2.0')).toBe(false);
    });

    test('a lower minimum: not below', () => {
        expect(isVersionBelowMinimum('1.2.0', '1.1.9')).toBe(false);
        expect(isVersionBelowMinimum('2.0.0', '1.9.9')).toBe(false);
    });

    test.each([
        ['1.2.0', '1.2.1'],
        ['1.2.0', '1.3.0'],
        ['1.2.0', '2.0.0'],
    ])('a higher minimum: %s is below %s', (client, minimum) => {
        expect(isVersionBelowMinimum(client, minimum)).toBe(true);
    });

    test('a suffix is dropped on both sides: 1.2.0-dev-abc1234 equals 1.2.0', () => {
        expect(isVersionBelowMinimum('1.2.0-dev-abc1234', '1.2.0')).toBe(false);
        expect(isVersionBelowMinimum('1.2.0', '1.2.0-dev-abc1234')).toBe(false);
        expect(isVersionBelowMinimum('1.2.0-dev-abc1234', '1.2.1')).toBe(true);
    });

    test('fields compare numerically: 1.10.0 is above 1.9.0', () => {
        expect(isVersionBelowMinimum('1.9.0', '1.10.0')).toBe(true);
        expect(isVersionBelowMinimum('1.10.0', '1.9.0')).toBe(false);
    });

    test.each(['', 'garbage', '1.2', 'v9.9.9', '9.9'])(
        'a malformed minimum %j never reports the client as outdated',
        minimum => {
            expect(isVersionBelowMinimum('1.2.0', minimum)).toBe(false);
        },
    );
});
