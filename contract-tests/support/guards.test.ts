import { describe, expect, it } from 'vitest';

import {
    parseRefreshResponse,
    parseRegisterResponse,
    parseSelfUserResponse,
} from './guards';

const validSelfUser = {
    id: 'user-id',
    email: 'contract@example.com',
    displayName: 'Contract User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'Food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: true,
        sex: 'male',
    },
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_100,
};

describe('parseRegisterResponse', () => {
    it('accepts the documented provisioning response shape', () => {
        const value = {
            runId: 'contract-run',
            user: {
                id: 'user-id',
                email: 'contract@example.com',
                displayName: 'Contract User',
            },
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
        };

        expect(parseRegisterResponse(value)).toEqual(value);
    });

    it.each([
        { field: 'runId', value: '' },
        { field: 'accessToken', value: '' },
        { field: 'refreshToken', value: '' },
        { field: 'expiresIn', value: 0 },
        { field: 'expiresIn', value: Number.POSITIVE_INFINITY },
    ])('rejects an invalid $field field', ({ field, value }) => {
        const response = {
            runId: 'contract-run',
            user: {
                id: 'user-id',
                email: 'contract@example.com',
                displayName: 'Contract User',
            },
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
            [field]: value,
        };

        expect(() => parseRegisterResponse(response)).toThrow();
    });

    it.each(['id', 'email', 'displayName'])('rejects an empty user.%s field', (field) => {
        expect(() =>
            parseRegisterResponse({
                runId: 'contract-run',
                user: {
                    id: 'user-id',
                    email: 'contract@example.com',
                    displayName: 'Contract User',
                    [field]: '',
                },
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                expiresIn: 3600,
            }),
        ).toThrow();
    });
});

describe('parseSelfUserResponse', () => {
    it('accepts the frontend self-user DTO shape', () => {
        expect(parseSelfUserResponse(validSelfUser)).toEqual(validSelfUser);
    });

    it.each([
        ['role', 'OWNER'],
        ['subscriptionUntil', 'never'],
        ['inviteToken', 42],
        ['createdAt', Number.NaN],
        ['updatedAt', Number.POSITIVE_INFINITY],
    ])('rejects invalid top-level %s', (field, value) => {
        expect(() =>
            parseSelfUserResponse({
                ...validSelfUser,
                [field]: value,
            }),
        ).toThrow();
    });

    it.each([
        ['timeFormat', '25h'],
        ['theme', 'blue'],
        ['simplifyDebts', 'yes'],
        ['skipCategory', 0],
        ['soloModeByDefault', null],
        ['saveGroupExpensesToSolo', 1],
        ['sex', 'unknown'],
    ])('rejects invalid settings.%s', (field, value) => {
        expect(() =>
            parseSelfUserResponse({
                ...validSelfUser,
                settings: {
                    ...validSelfUser.settings,
                    [field]: value,
                },
            }),
        ).toThrow();
    });

    it.each(['id', 'email', 'displayName'])('rejects an empty %s', (field) => {
        expect(() =>
            parseSelfUserResponse({
                ...validSelfUser,
                [field]: '',
            }),
        ).toThrow();
    });
});

describe('parseRefreshResponse', () => {
    it('accepts a non-empty refresh token pair', () => {
        const value = {
            token: 'new-access-token',
            refresh_token: 'new-refresh-token',
        };

        expect(parseRefreshResponse(value)).toEqual(value);
    });

    it.each([
        { refresh_token: 'new-refresh-token', token: '' },
        { refresh_token: '', token: 'new-access-token' },
        { refresh_token: 42, token: 'new-access-token' },
    ])('rejects an invalid refresh token pair', (value) => {
        expect(() => parseRefreshResponse(value)).toThrow();
    });
});
