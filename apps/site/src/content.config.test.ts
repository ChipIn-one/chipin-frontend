import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { contentBase } from './lib/contentSchema';

const VALID = {
    title: 'Privacy',
    description: 'How ChipIn uses information to operate the service for groups and friends.',
    locale: 'ru',
    translationKey: 'privacy',
    updatedAt: '2026-11-20',
};

describe('content frontmatter schema', () => {
    test('accepts a valid entry, draft defaults to false', () => {
        expect(contentBase.parse(VALID)).toMatchObject({ draft: false, locale: 'ru' });
    });

    test.each([
        ['a short description', { description: 'Too short.' }],
        ['a long description', { description: 'x'.repeat(161) }],
        ['an unsupported locale', { locale: 'de' }],
        ['an empty title', { title: '' }],
        ['an invalid date', { updatedAt: 'not a date' }],
    ])('rejects %s', (_, override) => {
        expect(contentBase.safeParse({ ...VALID, ...override }).success).toBe(false);
    });
});

// Spec 04 §3.3 (A-14): invalid frontmatter fails `astro build` — through the real
// src/content.config.ts, which the fixture re-exports.
describe('astro build', () => {
    test('fails on a content entry with invalid frontmatter', () => {
        const astroBin = join(
            dirname(createRequire(import.meta.url).resolve('astro/package.json')),
            'bin/astro.mjs',
        );
        const root = fileURLToPath(
            new URL('../test/fixtures/invalid-frontmatter/', import.meta.url),
        );
        const result = spawnSync(process.execPath, [astroBin, 'build', '--root', root], {
            encoding: 'utf8',
            env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
        });
        const output = `${result.stdout}\n${result.stderr}`;

        expect(result.status).not.toBe(0);
        expect(output).toMatch(/does not match collection schema/i);
        expect(output).toContain('description');
    });
});
